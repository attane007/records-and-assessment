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

	pdf.AddPage()

	// Use the selected font family
	pdf.SetFont(thaiFontFamily, "B", 16)

	// Header
	pdf.Cell(190, 10, "Ministry of Education")
	pdf.Ln(8)
	pdf.SetFont(thaiFontFamily, "", 14)
	pdf.Cell(190, 8, "Request for Academic Records (Por Por 1)")
	pdf.Ln(12)

	// Student Information
	pdf.SetFont(thaiFontFamily, "B", 12)
	pdf.Cell(50, 8, "Student Information")
	pdf.Ln(10)

	pdf.SetFont(thaiFontFamily, "", 10)
	pdf.Cell(40, 6, "Name: ")
	pdf.Cell(100, 6, request.Prefix+" "+request.Name)
	pdf.Ln(6)

	pdf.Cell(40, 6, "ID Card: ")
	pdf.Cell(100, 6, request.IDCard)
	pdf.Ln(6)

	pdf.Cell(40, 6, "Date of Birth: ")
	pdf.Cell(100, 6, request.DateOfBirth)
	pdf.Ln(6)

	if request.Class != "" && request.Room != "" {
		pdf.Cell(40, 6, "Class/Room: ")
		pdf.Cell(100, 6, request.Class+"/"+request.Room)
		pdf.Ln(6)
	}

	if request.AcademicYear != "" {
		pdf.Cell(40, 6, "Academic Year: ")
		pdf.Cell(100, 6, request.AcademicYear)
		pdf.Ln(6)
	}

	if request.FatherName != "" {
		pdf.Cell(40, 6, "Father's Name: ")
		pdf.Cell(100, 6, request.FatherName)
		pdf.Ln(6)
	}

	if request.MotherName != "" {
		pdf.Cell(40, 6, "Mother's Name: ")
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
