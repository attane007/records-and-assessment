package utils

import (
	"github.com/skip2/go-qrcode"
)

// GenerateQRCode generates a QR code image as a byte slice.
func GenerateQRCode(url string) ([]byte, error) {
	// 256x256 size, Medium recovery level
	return qrcode.Encode(url, qrcode.Medium, 256)
}
