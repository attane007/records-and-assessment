package utils

import (
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

// RegisterIDCardValidation registers custom 'idcard' validator (13 digits)
func RegisterIDCardValidation(v *validator.Validate) {
	v.RegisterValidation("idcard", func(fl validator.FieldLevel) bool {
		s := fl.Field().String()
		if len(s) != 13 {
			return false
		}
		for _, r := range s {
			if r < '0' || r > '9' {
				return false
			}
		}
		return true
	})
}

// ParseValidationErrors converts validator errors into a map[field]message
func ParseValidationErrors(errs validator.ValidationErrors, sample interface{}) map[string]string {
	out := map[string]string{}
	t := reflect.TypeOf(sample)
	fieldMap := map[string]string{}
	if t.Kind() == reflect.Struct {
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			jsonTag := strings.Split(f.Tag.Get("json"), ",")[0]
			if jsonTag == "" {
				jsonTag = strings.ToLower(f.Name)
			}
			fieldMap[f.Name] = jsonTag
		}
	}

	for _, e := range errs {
		fieldName := e.StructField()
		jsonKey := fieldMap[fieldName]
		switch e.Tag() {
		case "required":
			out[jsonKey] = "field is required"
		case "idcard":
			out[jsonKey] = "id_card must be exactly 13 numeric digits"
		default:
			out[jsonKey] = "validation failed on tag: " + e.Tag()
		}
	}
	return out
}
