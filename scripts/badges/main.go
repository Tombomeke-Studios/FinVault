package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	label := flag.String("label", "Build", "The label for the left side of the badge")
	value := flag.String("value", "passing", "The value for the right side of the badge")
	color := flag.String("color", "#8a2be2", "The hex color code for the value background")
	outPath := flag.String("out", "badge.svg", "The output path for the SVG file")
	flag.Parse()

	svgContent := generateSVG(*label, *value, *color)

	// Ensure output directory exists
	dir := filepath.Dir(*outPath)
	if dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			fmt.Printf("Error creating directory: %v\n", err)
			os.Exit(1)
		}
	}

	err := os.WriteFile(*outPath, []byte(svgContent), 0644)
	if err != nil {
		fmt.Printf("Error writing badge to %s: %v\n", *outPath, err)
		os.Exit(1)
	}

	fmt.Printf("Successfully generated badge at %s\n", *outPath)
}

func generateSVG(label, value, color string) string {
	// Simple width calculations based on string lengths
	labelWidth := len(label)*7 + 16
	valueWidth := len(value)*7 + 16
	totalWidth := labelWidth + valueWidth

	labelCenter := float64(labelWidth) / 2.0
	valueCenter := float64(labelWidth) + float64(valueWidth)/2.0

	// Use custom professional colors if named
	colorHex := color
	switch strings.ToLower(color) {
	case "green", "success":
		colorHex = "#4c1"
	case "violet", "purple":
		colorHex = "#8a2be2"
	case "blue", "info":
		colorHex = "#007ec6"
	case "orange", "warning":
		colorHex = "#fe7d37"
	case "red", "danger":
		colorHex = "#e05d44"
	}

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="%d" height="20">
  <linearGradient id="b" x2="0" y2="100%%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="%d" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <path fill="#555" d="M0 0h%dv20H0z"/>
    <path fill="%s" d="M%d 0h%dv20H%dz"/>
    <path fill="url(#b)" d="M0 0h%dv20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="%.1f" y="15" fill="#010101" fill-opacity=".3">%s</text>
    <text x="%.1f" y="14">%s</text>
    <text x="%.1f" y="15" fill="#010101" fill-opacity=".3">%s</text>
    <text x="%.1f" y="14">%s</text>
  </g>
</svg>`,
		totalWidth,
		totalWidth,
		labelWidth,
		colorHex, labelWidth, valueWidth, labelWidth,
		totalWidth,
		labelCenter, label,
		labelCenter, label,
		valueCenter, value,
		valueCenter, value,
	)
}
