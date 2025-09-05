package services

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// GeneratePDF generates a PDF for the given RequestRecord and returns the PDF bytes.
// GeneratePDF generates a PDF for the given RequestRecord and returns the PDF bytes.
// registrarName and directorName are the names to print on signature lines.
func GeneratePDF(request *RequestRecord, registrarName, directorName string) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")

	// Page margin variables (left, right, top, bottom)
	pageMargins := struct {
		Left   float64
		Right  float64
		Top    float64
		Bottom float64
	}{
		Left:   18, // mm
		Right:  18, // mm
		Top:    12, // mm
		Bottom: 18, // mm
	}
	// apply margins to pdf
	pdf.SetMargins(pageMargins.Left, pageMargins.Top, pageMargins.Right)
	pdf.SetAutoPageBreak(true, pageMargins.Bottom)

	// Try to load THSarabun.ttf from known locations and register as UTF-8 font
	thaiFontFamily := "Arial" // fallback

	// Build candidate paths including path relative to executable to be robust when running as binary
	tryPaths := []string{
		filepath.Join("fonts", "THSarabun.ttf"),
		filepath.Join("backend", "fonts", "THSarabun.ttf"),
		filepath.Join(".", "backend", "fonts", "THSarabun.ttf"),
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		tryPaths = append([]string{filepath.Join(exeDir, "fonts", "THSarabun.ttf"), filepath.Join(exeDir, "backend", "fonts", "THSarabun.ttf")}, tryPaths...)
	}

	var regBytes []byte
	var boldBytes []byte
	// search for regular and bold files separately
	candidatesReg := append([]string{}, tryPaths...)
	candidatesBold := []string{
		filepath.Join("fonts", "THSarabun Bold.ttf"),
		filepath.Join("backend", "fonts", "THSarabun Bold.ttf"),
		filepath.Join(".", "backend", "fonts", "THSarabun Bold.ttf"),
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidatesReg = append([]string{filepath.Join(exeDir, "fonts", "THSarabun.ttf"), filepath.Join(exeDir, "backend", "fonts", "THSarabun.ttf")}, candidatesReg...)
		candidatesBold = append([]string{filepath.Join(exeDir, "fonts", "THSarabun Bold.ttf"), filepath.Join(exeDir, "backend", "fonts", "THSarabun Bold.ttf")}, candidatesBold...)
	}

	for _, p := range candidatesReg {
		if b, err := os.ReadFile(p); err == nil {
			regBytes = b
			break
		}
	}
	for _, p := range candidatesBold {
		if b, err := os.ReadFile(p); err == nil {
			boldBytes = b
			break
		}
	}

	if regBytes != nil {
		pdf.AddUTF8FontFromBytes("THSarabun", "", regBytes)
		thaiFontFamily = "THSarabun"
	}
	if boldBytes != nil {
		pdf.AddUTF8FontFromBytes("THSarabun", "B", boldBytes)
	} else if regBytes != nil {
		// fallback: register bold style with same bytes if a separate bold file wasn't found
		pdf.AddUTF8FontFromBytes("THSarabun", "B", regBytes)
	}
	if thaiFontFamily == "Arial" {
		log.Printf("warning: THSarabun.ttf not found; using fallback font %s", thaiFontFamily)
	}

	// Try to find garuda image in common locations
	imgPaths := []string{
		filepath.Join("images", "garuda.png"),
		filepath.Join("backend", "images", "garuda.png"),
		filepath.Join(".", "backend", "images", "garuda.png"),
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		imgPaths = append([]string{filepath.Join(exeDir, "images", "garuda.png"), filepath.Join(exeDir, "backend", "images", "garuda.png")}, imgPaths...)
	}
	var imgPath string
	for _, p := range imgPaths {
		if _, err := os.Stat(p); err == nil {
			imgPath = p
			break
		}
	}

	// Start the first page, then draw centered crest and titles at the top
	pdf.AddPage()

	// Header with centered crest and titles (match provided form look)
	// If image found, draw it centered at top
	pageW, _ := pdf.GetPageSize()
	printableW := pageW - pageMargins.Left - pageMargins.Right
	if imgPath != "" {
		imgW := 25.0 // mm, adjust to match appearance
		x := pageMargins.Left + (printableW-imgW)/2
		// ImageOptions will accept file path directly
		opt := gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}
		pdf.ImageOptions(imgPath, x, pageMargins.Top/2+5, imgW, 0, false, opt, 0, "")
	}

	// Small vertical spacing after crest
	pdf.SetY(pageMargins.Top + 18)

	// Title lines: use THSarabun if available
	pdf.SetFont(thaiFontFamily, "B", 16)
	// choose title based on document type
	docType := strings.TrimSpace(request.DocumentType)
	// normalize common variants (ASCII dot vs thai char)
	docType = strings.ReplaceAll(docType, ".", "")
	docType = strings.ReplaceAll(docType, "๗", "7")
	// default title (for ปพ.1)
	title := "คำร้องขอใบระเบียนแสดงผลการเรียน(รบ.1/ปพ.1)"
	if docType == "ปพ7" || strings.Contains(request.DocumentType, "ปพ.7") || strings.Contains(request.DocumentType, "ปพ.๗") {
		title = "คำร้องขอใบรับรองผลการศึกษา(ปพ.7)"
	}
	pdf.CellFormat(0, 18, title, "", 1, "C", false, 0, "")
	pdf.Ln(3)

	// Add three lines of school address (left-aligned)
	pdf.SetFont(thaiFontFamily, "", 14)
	// Ensure text starts at left printable margin
	pdf.SetX(pageMargins.Left + 130)
	pdf.CellFormat(printableW, 6, "โรงเรียนโพนงามพิทยานุกูล", "", 1, "L", false, 0, "")
	pdf.SetX(pageMargins.Left + 130)
	pdf.CellFormat(printableW, 6, "ต. โพนงาม  อ. โกสุมพิสัย", "", 1, "L", false, 0, "")
	pdf.SetX(pageMargins.Left + 130)
	pdf.CellFormat(printableW, 6, "จ.มหาสารคาม 44140", "", 1, "L", false, 0, "")
	pdf.Ln(6)

	pdf.SetY(pageMargins.Top + 60)
	pdf.SetFont(thaiFontFamily, "", 14)
	// Format request.CreatedAt into Thai date (day, Thai month name, Buddhist year)
	reqDate := request.CreatedAt
	thaiMonths := []string{"มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"}
	day := reqDate.Day()
	month := ""
	if int(reqDate.Month()) >= 1 && int(reqDate.Month()) <= 12 {
		month = thaiMonths[int(reqDate.Month())-1]
	}
	year := reqDate.Year() + 543
	dateStr := fmt.Sprintf("วันที่ %d  เดือน %s  พ.ศ. %d", day, month, year)
	pdf.SetX(pageMargins.Left + printableW/2)
	pdf.CellFormat(0, 6, dateStr, "", 1, "L", false, 0, "")
	pdf.Ln(6)

	if docType == "ปพ7" || strings.Contains(request.DocumentType, "ปพ.7") || strings.Contains(request.DocumentType, "ปพ.๗") {
		pdf.SetY(pageMargins.Top + 68)
		pdf.SetX(pageMargins.Left)
		pdf.CellFormat(printableW, 6, "เรื่อง    ขอใบรับรองผลการศึกษา(ปพ.7)", "", 1, "L", false, 0, "")
	} else {
		// Default subject for ปพ.1 (รบ.1)
		pdf.SetY(pageMargins.Top + 68)
		pdf.SetX(pageMargins.Left)
		pdf.CellFormat(printableW, 6, "เรื่อง    ขอใบระเบียนแสดงผลการเรียน(รบ.1/ปพ.1)", "", 1, "L", false, 0, "")
	}
	pdf.Ln(6)

	pdf.SetY(pageMargins.Top + 77)
	pdf.SetX(pageMargins.Left)
	pdf.CellFormat(printableW, 6, "เรียน   ผู้อำนวยการโรงเรียนโพนงามพิทยานุกูล", "", 1, "L", false, 0, "")
	pdf.Ln(6)

	pdf.SetY(pageMargins.Top + 90)
	pdf.SetX(pageMargins.Left + 9)
	// Split into two cells so filling name and ID won't shift each other
	leftWidth := printableW * 0.45
	rightWidth := printableW - leftWidth
	name := strings.TrimSpace(request.Prefix + request.Name)
	// Left: split into label cell and value cell
	labelLeftW := leftWidth * 0.2
	valueLeftW := leftWidth - labelLeftW
	pdf.CellFormat(labelLeftW, 6, "ข้าพเจ้า: _____________________________________", "", 0, "L", false, 0, "")
	pdf.CellFormat(valueLeftW, 6, name, "", 0, "C", false, 0, "")
	// Right: split into label cell, ID value cell, and class/room cell
	labelRightW := rightWidth * 0.38
	// reserve a portion of rightWidth for the class/room cell
	classCellW := rightWidth * 0.3
	valueRightW := rightWidth - labelRightW - classCellW
	pdf.CellFormat(labelRightW, 6, "เลขประจำตัวประชาชน:____________________", "", 0, "L", false, 0, "")
	pdf.CellFormat(valueRightW, 6, request.IDCard, "", 0, "L", false, 0, "")
	// class/room cell (label + value)
	classVal := strings.TrimSpace(request.Class + "/" + request.Room)
	if classVal == "/" {
		// empty class/room
		classVal = ""
	}
	labelClassW := classCellW * 0.28
	valueClassW := classCellW - labelClassW
	pdf.CellFormat(labelClassW, 6, "ชั้น: _______", "", 0, "L", false, 0, "")
	pdf.CellFormat(valueClassW, 6, classVal, "", 1, "L", false, 0, "")

	pdf.SetY(pageMargins.Top + 100)
	pdf.SetX(pageMargins.Left)
	pdf.CellFormat(15, 6, "รหัสนักเรียน:______________", "", 0, "L", false, 0, "")
	pdf.CellFormat(30, 6, request.StudentID, "", 0, "C", false, 0, "")
	pdf.CellFormat(15, 6, "ปีการศึกษา: _______________", "", 0, "L", false, 0, "")
	pdf.CellFormat(30, 6, request.AcademicYear, "", 0, "C", false, 0, "")
	// Parse DateOfBirth
	dob, err := time.Parse("2006-01-02", request.DateOfBirth)
	if err != nil {
		dob = time.Time{}
	}
	birthDay := dob.Day()
	monthStr := ""
	if dob.Month() >= 1 && dob.Month() <= 12 {
		monthStr = thaiMonths[dob.Month()-1]
	}
	birthYear := dob.Year() + 543
	pdf.CellFormat(13, 6, "เกิดวันที่: _____", "", 0, "L", false, 0, "")
	pdf.CellFormat(10, 6, fmt.Sprintf("%d", birthDay), "", 0, "C", false, 0, "")
	pdf.CellFormat(13, 6, "เดือน: _______________", "", 0, "L", false, 0, "")
	pdf.CellFormat(24, 6, monthStr, "", 0, "C", false, 0, "")
	pdf.CellFormat(6, 6, "พ.ศ.: ________", "", 0, "L", false, 0, "")
	pdf.CellFormat(20, 6, fmt.Sprintf("%d", birthYear), "", 1, "C", false, 0, "")
	pdf.Ln(5)

	pdf.CellFormat(15, 6, "บิดาชื่อ: ___________________________________________", "", 0, "L", false, 0, "")
	pdf.CellFormat(72, 6, request.FatherName, "", 0, "C", false, 0, "")
	pdf.CellFormat(15, 6, "มารดาชื่อ: ________________________________________", "", 0, "L", false, 0, "")
	pdf.CellFormat(72, 6, request.MotherName, "", 0, "C", false, 0, "")
	pdf.Ln(10)

	if docType == "ปพ7" || strings.Contains(request.DocumentType, "ปพ.7") || strings.Contains(request.DocumentType, "ปพ.๗") {
		pdf.CellFormat(printableW, 6, "มีความประสงค์จะขอใบรับรองผลการศึกษา(ปพ.7) จำนวน 1 ฉบับ", "", 0, "L", false, 0, "")
	} else {
		pdf.CellFormat(printableW, 6, "มีความประสงค์จะขอใบระเบียนแสดงผลการเรียน(รบ.1/ปพ.1) จำนวน 1 ฉบับ", "", 0, "L", false, 0, "")
	}
	pdf.Ln(10)

	pdf.CellFormat(10, 6, "เพื่อ: _______________________________________________________________________________________________", "", 0, "L", false, 0, "")
	pdf.CellFormat(160, 6, request.Purpose, "", 0, "L", false, 0, "")
	pdf.Ln(10)

	pdf.SetX(pageMargins.Left + 9)
	pdf.CellFormat(10, 6, "ทั้งนี้  ข้าพเจ้าได้แนบเอกสารหลักฐานต่างๆ มาด้วยแล้ว", "", 0, "L", false, 0, "")
	pdf.Ln(7)
	pdf.SetX(pageMargins.Left + 18)
	pdf.CellFormat(10, 6, "1. รูปถ่ายขนาด 1.5 นิ้ว (ถ่ายไว้ไม่เกิน 6 เดือน)    จำนวน 2 รูป", "", 0, "L", false, 0, "")
	pdf.Ln(7)
	pdf.SetX(pageMargins.Left + 18)
	pdf.CellFormat(10, 6, "2. สำเนาบัตรประชาชน (กรณีเป็นศิษย์เก่า)", "", 0, "L", false, 0, "")
	pdf.Ln(7)
	pdf.SetX(pageMargins.Left + 18)
	pdf.CellFormat(10, 6, "3. ใบแจ้งความเอกสารหาย (กรณีหายหรือชำรุด)", "", 0, "L", false, 0, "")

	pdf.Ln(10)
	pdf.SetX(pageMargins.Left + 9)
	pdf.CellFormat(10, 6, "จึงเรียนมาเพื่อโปรดพิจารณา", "", 0, "L", false, 0, "")
	pdf.Ln(7)
	pdf.SetX(pageMargins.Left + 120)
	pdf.CellFormat(10, 6, "ขอแสดงความนับถือ", "", 0, "C", false, 0, "")
	pdf.Ln(14)
	pdf.SetX(pageMargins.Left + 120)
	pdf.CellFormat(10, 6, "ลงชื่อ ______________________________", "", 0, "C", false, 0, "")
	pdf.Ln(7)
	pdf.SetX(pageMargins.Left + 120)
	// use provided name for requester
	pdf.CellFormat(10, 6, fmt.Sprintf("( %s )", name), "", 0, "C", false, 0, "")
	pdf.Ln(7)

	// Draw a thin horizontal line beneath the printed name (signature line)
	// y position a few mm below the current Y to sit under the text
	yLine := pdf.GetY() + 4
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.2)
	pdf.Line(pageMargins.Left, yLine, pageMargins.Left+printableW, yLine)
	pdf.Ln(7)

	// Render the registrar comment label in bold using the current font size
	curFontSize, _ := pdf.GetFontSize()
	pdf.SetFont(thaiFontFamily, "B", curFontSize)
	pdf.CellFormat(printableW/2, 6, "ความเห็นนายทะเบียน", "", 0, "L", false, 0, "")
	// pdf.CellFormat(40, 6, "", "1", 0, "L", false, 0, "")
	pdf.CellFormat(10, 6, "ความเห็นผู้อำนวยการ", "", 0, "L", false, 0, "")
	// restore previous font style
	pdf.SetFont(thaiFontFamily, "", curFontSize)
	pdf.Ln(10)
	pdf.SetX(pageMargins.Left + 9)
	pdf.CellFormat(18.0, 6, "เห็นควร", "", 0, "L", false, 0, "")

	xRef := pdf.GetX()
	yRef := pdf.GetY() + 3.0 // center vertically in the 6mm-high cell
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.3)
	// draw circle slightly offset from current X
	pdf.CellFormat(5, 6, "", "", 0, "L", false, 0, "")
	pdf.Circle(xRef, yRef, 2.5, "D")
	pdf.CellFormat(25, 6, "อนุญาติ", "", 0, "L", false, 0, "")
	xRef = pdf.GetX()
	pdf.Circle(xRef-5, yRef, 2.5, "D")
	pdf.CellFormat(40, 6, "ไม่อนุญาติ", "", 0, "L", false, 0, "")

	pdf.CellFormat(18.0, 6, "เห็นควร", "", 0, "L", false, 0, "")
	xRef = pdf.GetX()
	pdf.CellFormat(5, 6, "", "", 0, "L", false, 0, "")
	pdf.Circle(xRef, yRef, 2.5, "D")
	pdf.CellFormat(25, 6, "อนุญาติ", "", 0, "L", false, 0, "")
	xRef = pdf.GetX()
	pdf.Circle(xRef-5, yRef, 2.5, "D")
	pdf.CellFormat(10, 6, "ไม่อนุญาติ", "", 0, "L", false, 0, "")

	pdf.Ln(15)
	pdf.CellFormat(printableW/2, 6, "ลงนาม ______________________________", "", 0, "C", false, 0, "")
	pdf.CellFormat(printableW/2, 6, "ลงนาม ______________________________", "", 0, "C", false, 0, "")
	pdf.Ln(7)
	// registrarName and directorName are provided by caller (handler did DB lookup and fallback)
	pdf.CellFormat(printableW/2, 6, fmt.Sprintf("( %s )", registrarName), "", 0, "C", false, 0, "")
	pdf.CellFormat(printableW/2, 6, fmt.Sprintf("( %s )", directorName), "", 0, "C", false, 0, "")
	pdf.Ln(7)
	pdf.CellFormat(printableW/2, 6, "___/___/___", "", 0, "C", false, 0, "")
	pdf.CellFormat(printableW/2, 6, "___/___/___", "", 0, "C", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
