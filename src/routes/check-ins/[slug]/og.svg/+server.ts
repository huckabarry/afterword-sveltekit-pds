import { error } from '@sveltejs/kit';
import { getCheckinBySlug } from '$lib/server/atproto';

function escapeXml(value: string) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function truncate(value: string, length: number) {
	const trimmed = String(value || '').trim();
	if (trimmed.length <= length) return trimmed;
	return `${trimmed.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

export async function GET({ params }) {
	const item = await getCheckinBySlug(params.slug);

	if (!item) {
		throw error(404, 'Check-in not found');
	}

	const title = escapeXml(truncate(item.name, 52));
	const subtitle = escapeXml(truncate(item.place || item.address || 'Afterword check-in', 72));
	const note = escapeXml(truncate(item.note || item.excerpt || '', 180));
	const lat = typeof item.latitude === 'number' ? item.latitude.toFixed(3) : null;
	const lon = typeof item.longitude === 'number' ? item.longitude.toFixed(3) : null;
	const coordinateLabel = lat && lon ? `${lat}, ${lon}` : 'Location shared from Afterword';

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#171819"/>
      <stop offset="1" stop-color="#232526"/>
    </linearGradient>
    <pattern id="grid" width="84" height="84" patternUnits="userSpaceOnUse">
      <path d="M84 0H0V84" stroke="#333738" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" rx="32" fill="url(#bg)"/>
  <rect x="56" y="56" width="540" height="518" rx="28" fill="#202223"/>
  <rect x="56" y="56" width="540" height="518" rx="28" fill="url(#grid)" opacity="0.65"/>
  <path d="M326 179C281.817 179 246 214.817 246 259C246 331 326 423 326 423C326 423 406 331 406 259C406 214.817 370.183 179 326 179Z" fill="#F2F4A3"/>
  <circle cx="326" cy="259" r="31" fill="#171819"/>
  <circle cx="326" cy="259" r="19" fill="#F2F4A3"/>
  <rect x="640" y="80" width="482" height="40" rx="12" fill="#2B2E2F"/>
  <text x="640" y="108" fill="#F2F4A3" font-size="24" font-family="Fira Sans, Arial, sans-serif" font-weight="700">CHECK-IN</text>
  <text x="640" y="190" fill="#FFFFFF" font-size="58" font-family="Fira Sans, Arial, sans-serif" font-weight="800">${title}</text>
  <text x="640" y="246" fill="#C3C6C7" font-size="30" font-family="Fira Sans, Arial, sans-serif">${subtitle}</text>
  <text x="640" y="314" fill="#A7ABAC" font-size="24" font-family="IBM Plex Mono, monospace">${escapeXml(coordinateLabel)}</text>
  ${
		note
			? `<foreignObject x="640" y="360" width="470" height="158">
      <div xmlns="http://www.w3.org/1999/xhtml" style="color:#E5E7E8;font-family:'Fira Sans',Arial,sans-serif;font-size:28px;line-height:1.35;">
        ${note}
      </div>
    </foreignObject>`
			: ''
	}
  <text x="640" y="552" fill="#F2F4A3" font-size="24" font-family="IBM Plex Mono, monospace">afterword.blog</text>
</svg>`;

	return new Response(svg, {
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
}
