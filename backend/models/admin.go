package models

// Admin holds admin user credentials
type Admin struct {
	Username string `bson:"username" json:"username"`
	Password string `bson:"password" json:"password"` // This will be hashed
}

// ChangePasswordRequest represents the request payload for changing password
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=6"`
}
