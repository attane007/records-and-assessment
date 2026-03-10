package services

import (
	"backend/models"
	"bytes"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
	"github.com/skip2/go-qrcode"
)

func decodeSignatureData(raw string) ([]byte, string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, "", fmt.Errorf("empty signature")
	}

	encoded := trimmed
	imageType := "PNG"
	if strings.HasPrefix(trimmed, "data:") {
		comma := strings.Index(trimmed, ",")
		if comma < 0 {
			return nil, "", fmt.Errorf("invalid data url")
		}
		header := strings.ToLower(trimmed[:comma])
		if strings.Contains(header, "image/jpeg") || strings.Contains(header, "image/jpg") {
			imageType = "JPG"
		} else if strings.Contains(header, "image/png") {
			imageType = "PNG"
		} else {
			return nil, "", fmt.Errorf("unsupported signature format")
		}
		encoded = trimmed[comma+1:]
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(encoded)
		if err != nil {
			return nil, "", err
		}
	}
	return decoded, imageType, nil
}

func drawSignatureImage(pdf *gofpdf.Fpdf, alias string, rawData string, x, y, w, h float64) {
	data, imageType, err := decodeSignatureData(rawData)
	if err != nil {
		return
	}

	opt := gofpdf.ImageOptions{ImageType: imageType, ReadDpi: true}
	pdf.RegisterImageOptionsReader(alias, opt, bytes.NewReader(data))
	pdf.ImageOptions(alias, x, y, w, h, false, opt, 0, "")
}

func drawDecisionCircle(pdf *gofpdf.Fpdf, x, y float64, selected bool) {
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.3)
	pdf.Circle(x, y, 2.5, "D")
	if selected {
		pdf.SetFillColor(0, 0, 0)
		pdf.Circle(x, y, 1.2, "F")
	}
}

// GeneratePDF generates a PDF for the given RequestRecord and returns the PDF bytes.
// registrarName and directorName are the names to print on signature lines.
// baseURL is the public URL used to build the verification QR code.
func GeneratePDF(request *RequestRecord, registrarName, directorName, baseURL string) ([]byte, error) {
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

	// Requester/Student Signature Block
	sigBlockW := 80.0
	sigBlockX := pageMargins.Left + printableW - sigBlockW
	pdf.SetX(sigBlockX)
	pdf.CellFormat(sigBlockW, 6, "ขอแสดงความนับถือ", "", 1, "C", false, 0, "")
	pdf.Ln(10) // Reduced from 14 to move signature up

	// Signature line with "ลงชื่อ"
	pdf.SetX(sigBlockX)
	studentSignLineY := pdf.GetY()
	labelStr := "ลงชื่อ "
	underlineStr := "______________________________"
	if request.Signatures.Student != nil {
		underlineStr = "                              " // Omit underline if signature exists
	}
	labelW := pdf.GetStringWidth(labelStr)
	underlineW := pdf.GetStringWidth(underlineStr)
	totalLineW := labelW + underlineW
	// Position to center the combined label and underline within sigBlockW
	lineStartX := sigBlockX + (sigBlockW-totalLineW)/2

	pdf.SetX(lineStartX)
	pdf.CellFormat(labelW, 6, labelStr, "", 0, "L", false, 0, "")
	pdf.CellFormat(underlineW, 6, underlineStr, "", 1, "L", false, 0, "")

	if request.Signatures.Student != nil {
		signatureW := 40.0
		if signatureW > underlineW {
			signatureW = underlineW
		}
		// Center signature image specifically over the underline part to avoid overlapping "ลงชื่อ"
		imgX := lineStartX + labelW + (underlineW-signatureW)/2
		// Move up slightly more by adjusting Y offset from studentSignLineY
		drawSignatureImage(pdf, "sig-student", request.Signatures.Student.DataBase64, imgX, studentSignLineY-4.0, signatureW, 11)
	}

	// Name in parentheses - center only over the underline part to match signature
	pdf.SetX(lineStartX + labelW)
	pdf.CellFormat(underlineW, 6, fmt.Sprintf("( %s )", name), "", 1, "C", false, 0, "")
	pdf.Ln(4) // Reduced from 7

	// Draw a thin horizontal line beneath the printed name (signature line)
	yLine := pdf.GetY() + 2 // Reduced from 4
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.2)
	pdf.Line(pageMargins.Left, yLine, pageMargins.Left+printableW, yLine)
	pdf.Ln(5) // Reduced from 7

	// Registrar and Director Comments
	curFontSize, _ := pdf.GetFontSize()
	pdf.SetFont(thaiFontFamily, "B", curFontSize)
	pdf.CellFormat(printableW/2, 6, "ความเห็นนายทะเบียน", "", 0, "L", false, 0, "")
	pdf.CellFormat(10, 6, "ความเห็นผู้อำนวยการ", "", 0, "L", false, 0, "")
	pdf.SetFont(thaiFontFamily, "", curFontSize)
	pdf.Ln(7) // Reduced from 10

	pdf.SetX(pageMargins.Left + 9)
	pdf.CellFormat(18.0, 6, "เห็นควร", "", 0, "L", false, 0, "")
	yRef := pdf.GetY() + 3.0

	registrarApprove := request.Decisions.Registrar != nil && request.Decisions.Registrar.Decision == models.OfficialDecisionApprove
	registrarReject := request.Decisions.Registrar != nil && request.Decisions.Registrar.Decision == models.OfficialDecisionReject
	directorApprove := request.Decisions.Director != nil && request.Decisions.Director.Decision == models.OfficialDecisionApprove
	directorReject := request.Decisions.Director != nil && request.Decisions.Director.Decision == models.OfficialDecisionReject

	registrarApproveCircleX := pdf.GetX() + 2.5
	pdf.CellFormat(5, 6, "", "", 0, "L", false, 0, "")
	drawDecisionCircle(pdf, registrarApproveCircleX, yRef, registrarApprove)
	pdf.CellFormat(25, 6, "อนุญาต", "", 0, "L", false, 0, "")
	registrarRejectCircleX := pdf.GetX() + 2.5
	pdf.CellFormat(5, 6, "", "", 0, "L", false, 0, "")
	drawDecisionCircle(pdf, registrarRejectCircleX, yRef, registrarReject)
	pdf.CellFormat(40, 6, "ไม่อนุญาต", "", 0, "L", false, 0, "")

	pdf.CellFormat(18.0, 6, "เห็นควร", "", 0, "L", false, 0, "")
	directorApproveCircleX := pdf.GetX() + 2.5
	pdf.CellFormat(5, 6, "", "", 0, "L", false, 0, "")
	drawDecisionCircle(pdf, directorApproveCircleX, yRef, directorApprove)
	pdf.CellFormat(25, 6, "อนุญาต", "", 0, "L", false, 0, "")
	directorRejectCircleX := pdf.GetX() + 2.5
	pdf.CellFormat(5, 6, "", "", 0, "L", false, 0, "")
	drawDecisionCircle(pdf, directorRejectCircleX, yRef, directorReject)
	pdf.CellFormat(10, 6, "ไม่อนุญาต", "", 0, "L", false, 0, "")

	pdf.Ln(13) // Increased from 10 to avoid overlap with signature

	// Official Signatures (Registrar and Director)
	officialSignLineY := pdf.GetY()
	colW := printableW / 2
	officialLabel := "ลงนาม "
	registrarUnderline := "______________________________"
	if request.Signatures.Registrar != nil {
		registrarUnderline = "                              "
	}
	directorUnderline := "______________________________"
	if request.Signatures.Director != nil {
		directorUnderline = "                              "
	}

	offLabelW := pdf.GetStringWidth(officialLabel)
	offUnderlineW := pdf.GetStringWidth("______________________________")
	offTotalW := offLabelW + offUnderlineW

	// Registrar Column
	regColStartX := pageMargins.Left
	regSignStartX := regColStartX + (colW-offTotalW)/2
	pdf.SetX(regSignStartX)
	pdf.CellFormat(offLabelW, 6, officialLabel, "", 0, "L", false, 0, "")
	pdf.CellFormat(offUnderlineW, 6, registrarUnderline, "", 0, "L", false, 0, "")

	// Director Column
	dirColStartX := pageMargins.Left + colW
	dirSignStartX := dirColStartX + (colW-offTotalW)/2
	pdf.SetX(dirSignStartX)
	pdf.CellFormat(offLabelW, 6, officialLabel, "", 0, "L", false, 0, "")
	pdf.CellFormat(offUnderlineW, 6, directorUnderline, "", 1, "L", false, 0, "")

	if request.Signatures.Registrar != nil {
		sigW := 40.0
		if sigW > offUnderlineW {
			sigW = offUnderlineW
		}
		// Center signature relative to the entire "ลงนาม _____" block
		imgX := regSignStartX + (offTotalW-sigW)/2
		drawSignatureImage(pdf, "sig-registrar", request.Signatures.Registrar.DataBase64, imgX, officialSignLineY-4.0, sigW, 12)
	}
	if request.Signatures.Director != nil {
		sigW := 40.0
		if sigW > offUnderlineW {
			sigW = offUnderlineW
		}
		// Center signature relative to the entire "ลงนาม _____" block
		imgX := dirSignStartX + (offTotalW-sigW)/2
		drawSignatureImage(pdf, "sig-director", request.Signatures.Director.DataBase64, imgX, officialSignLineY-4.0, sigW, 12)
	}

	pdf.Ln(5) // Reduced from 7
	pdf.CellFormat(colW, 6, fmt.Sprintf("( %s )", registrarName), "", 0, "C", false, 0, "")
	pdf.CellFormat(colW, 6, fmt.Sprintf("( %s )", directorName), "", 1, "C", false, 0, "")
	pdf.Ln(5) // Reduced from 7

	// Helper for Thai short date format: Day/ShortMonth/BuddhistYear
	formatThaiShortDate := func(t time.Time) string {
		if t.IsZero() {
			return "___/___/___"
		}
		shortMonths := []string{"ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."}
		mIdx := int(t.Month()) - 1
		if mIdx < 0 || mIdx > 11 {
			return "___/___/___"
		}
		return fmt.Sprintf("%d/%s/%d", t.Day(), shortMonths[mIdx], t.Year()+543)
	}

	regDateStr := "___/___/___"
	if request.Decisions.Registrar != nil && !request.Decisions.Registrar.DecidedAt.IsZero() {
		regDateStr = formatThaiShortDate(request.Decisions.Registrar.DecidedAt)
	}
	dirDateStr := "___/___/___"
	if request.Decisions.Director != nil && !request.Decisions.Director.DecidedAt.IsZero() {
		dirDateStr = formatThaiShortDate(request.Decisions.Director.DecidedAt)
	}

	pdf.CellFormat(colW, 6, regDateStr, "", 0, "C", false, 0, "")
	pdf.CellFormat(colW, 6, dirDateStr, "", 1, "C", false, 0, "")

	// --- Traceability Footer (ETDA Compliance) ---
	// Pick the most relevant hash (latest one available)
	refHash := ComputeRequestHash(request)
	if request.Signatures.Director != nil && request.Signatures.Director.DocumentHash != "" {
		refHash = request.Signatures.Director.DocumentHash
	} else if request.Signatures.Registrar != nil && request.Signatures.Registrar.DocumentHash != "" {
		refHash = request.Signatures.Registrar.DocumentHash
	} else if request.Signatures.Student != nil && request.Signatures.Student.DocumentHash != "" {
		refHash = request.Signatures.Student.DocumentHash
	}

	// Draw verification QR code at the bottom left
	if baseURL != "" && refHash != "" {
		verifyURL := fmt.Sprintf("%s/verify?hash=%s", strings.TrimRight(baseURL, "/"), refHash)
		qrBytes, err := qrcode.Encode(verifyURL, qrcode.Medium, 256)
		if err == nil {
			qrAlias := "qr-verification"
			pdf.RegisterImageOptionsReader(qrAlias, gofpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(qrBytes))
			// Draw at bottom-left margin
			pdf.ImageOptions(qrAlias, pageMargins.Left, 270, 15, 15, false, gofpdf.ImageOptions{ImageType: "PNG"}, 0, "")

			// Draw Reference Hash next to QR
			pdf.SetFont(thaiFontFamily, "", 8)
			pdf.SetTextColor(100, 100, 100)
			pdf.SetXY(pageMargins.Left+17, 270+5)
			pdf.CellFormat(0, 4, "ตรวจสอบความครบถ้วนของเอกสาร (Digital Verification Reference):", "", 1, "L", false, 0, "")
			pdf.SetX(pageMargins.Left + 17)
			pdf.CellFormat(0, 4, refHash, "", 1, "L", false, 0, "")
			pdf.SetTextColor(0, 0, 0) // reset
		}
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
