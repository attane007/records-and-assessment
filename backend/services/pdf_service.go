package services

import (
	"bytes"
	"log"
	"os"
	"path/filepath"

	"github.com/jung-kurt/gofpdf"
)

// GeneratePDF generates a PDF for the given RequestRecord and returns the PDF bytes.
func GeneratePDF(request *RequestRecord) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")

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
	if imgPath != "" {
		imgW := 28.0 // mm, adjust to match appearance
		x := (pageW - imgW) / 2
		// ImageOptions will accept file path directly
		opt := gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}
		pdf.ImageOptions(imgPath, x, 8, imgW, 0, false, opt, 0, "")
	}

	// Small vertical spacing after crest
	pdf.SetY(28)

	// Title lines: use THSarabun if available
	pdf.SetFont(thaiFontFamily, "B", 18)
	pdf.CellFormat(0, 8, "คำร้องขอใบระเบียนแสดงผลการเรียน(รบ.๑/ปพ.๑)", "", 1, "C", false, 0, "")
	pdf.Ln(2)
	pdf.SetFont(thaiFontFamily, "", 12)
	pdf.CellFormat(0, 6, "โรงเรียนตัวอย่างบนฟอร์ม", "", 1, "C", false, 0, "")
	pdf.Ln(6)

	// Use the selected font family for the form body
	pdf.SetFont(thaiFontFamily, "", 12)

	// Student Information header (left-aligned)
	pdf.SetY(60)
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
