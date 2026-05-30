import fs from 'fs';
import path from 'path';

function generateSVG(label, value, color) {
  const labelWidth = label.length * 7 + 16;
  const valueWidth = value.length * 7 + 16;
  const totalWidth = labelWidth + valueWidth;

  const labelCenter = labelWidth / 2.0;
  const valueCenter = labelWidth + valueWidth / 2.0;

  let colorHex = color;
  if (color === 'green' || color === 'success') colorHex = '#4c1';
  else if (color === 'violet' || color === 'purple') colorHex = '#8a2be2';
  else if (color === 'blue' || color === 'info') colorHex = '#007ec6';
  else if (color === 'orange' || color === 'warning') colorHex = '#fe7d37';
  else if (color === 'red' || color === 'danger') colorHex = '#e05d44';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <path fill="#555" d="M0 0h${labelWidth}v20H0z"/>
    <path fill="${colorHex}" d="M${labelWidth} 0h${valueWidth}v20H${labelWidth}z"/>
    <path fill="url(#b)" d="M0 0h${totalWidth}v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelCenter}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelCenter}" y="14">${label}</text>
    <text x="${valueCenter}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${valueCenter}" y="14">${value}</text>
  </g>
</svg>`;
}

function writeBadge(label, value, color, filename) {
  const svg = generateSVG(label, value, color);
  const outDir = path.join(process.cwd(), 'assets', 'badges');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, filename);
  fs.writeFileSync(outFile, svg, 'utf8');
  console.log(`Successfully generated badge at assets/badges/${filename}`);
}

// Generate the 5 core badges
writeBadge('Architecture', 'Microservices', '#8a2be2', 'architecture.svg');
writeBadge('Language', 'TypeScript', '#007ec6', 'language.svg');
writeBadge('Database', 'SQLite', '#4c1', 'database.svg');
writeBadge('CI/CD', 'GitHub Actions', '#fe7d37', 'pipeline.svg');
writeBadge('Deploy', 'Docker', '#007ec6', 'deploy.svg');
