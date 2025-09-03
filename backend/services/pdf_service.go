package services

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/jung-kurt/gofpdf"
)

// GeneratePDF generates a PDF for the given RequestRecord and returns the PDF bytes.
func GeneratePDF(request *RequestRecord) ([]byte, error) {
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
	pdf.SetFont(thaiFontFamily, "", 12)
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
		pdf.SetY(pageMargins.Top + 65)
		pdf.SetX(pageMargins.Left)
		pdf.CellFormat(printableW, 6, "เรื่อง    ขอใบรับรองผลการศึกษา(ปพ.7)", "", 1, "L", false, 0, "")
	} else {
		// Default subject for ปพ.1 (รบ.1)
		pdf.SetY(pageMargins.Top + 65)
		pdf.SetX(pageMargins.Left)
		pdf.CellFormat(printableW, 6, "เรื่อง    ขอใบระเบียนแสดงผลการเรียน(รบ.1/ปพ.1)", "", 1, "L", false, 0, "")
	}

	// Student Information header (left-aligned)
	// Position student info area below header/title
	pdf.SetY(pageMargins.Top + 36)
	pdf.SetFont(thaiFontFamily, "B", 12)
	pdf.Cell(50, 8, "ข้อมูลผู้ขอ")
	pdf.Ln(10)

	pdf.SetFont(thaiFontFamily, "", 10)
	pdf.Cell(40, 6, "ชื่อนามสกุล: ")
	pdf.Cell(100, 6, request.Prefix+" "+request.Name)
	pdf.Ln(6)

	pdf.Cell(40, 6, "เลขบัตรประชาชน: ")
	pdf.Cell(100, 6, request.IDCard)
	pdf.Ln(6)

	pdf.Cell(40, 6, "วันเกิด: ")
	pdf.Cell(100, 6, request.DateOfBirth)
	pdf.Ln(6)

	if request.Class != "" && request.Room != "" {
		pdf.Cell(40, 6, "ชั้น/ห้อง: ")
		pdf.Cell(100, 6, request.Class+"/"+request.Room)
		pdf.Ln(6)
	}

	if request.AcademicYear != "" {
		pdf.Cell(40, 6, "ปีการศึกษา: ")
		pdf.Cell(100, 6, request.AcademicYear)
		pdf.Ln(6)
	}

	if request.FatherName != "" {
		pdf.Cell(40, 6, "ชื่อบิดา: ")
		pdf.Cell(100, 6, request.FatherName)
		pdf.Ln(6)
	}

	if request.MotherName != "" {
		pdf.Cell(40, 6, "ชื่อมารดา: ")
		pdf.Cell(100, 6, request.MotherName)
		pdf.Ln(6)
	}

	pdf.Ln(8)

	// Request Details
	pdf.SetFont(thaiFontFamily, "B", 12)
	pdf.Cell(50, 8, "Request Details")
	pdf.Ln(10)

	pdf.SetFont(thaiFontFamily, "", 10)
	pdf.Cell(40, 6, "Document Type: ")
	pdf.Cell(100, 6, request.DocumentType)
	pdf.Ln(6)

	pdf.Cell(40, 6, "Purpose: ")
	pdf.MultiCell(150, 6, request.Purpose, "", "", false)
	pdf.Ln(8)

	// Date
	pdf.Cell(40, 6, "Request Date: ")
	pdf.Cell(100, 6, request.CreatedAt.Format("2006-01-02 15:04:05"))
	pdf.Ln(15)

	// Signature area
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(95, 6, "Applicant Signature: _________________")
	pdf.Cell(95, 6, "Date: _________________")
	pdf.Ln(15)

	pdf.Cell(95, 6, "Officer Signature: _________________")
	pdf.Cell(95, 6, "Date: _________________")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
