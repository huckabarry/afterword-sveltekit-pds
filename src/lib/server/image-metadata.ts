export type ImageDimensions = {
	width: number;
	height: number;
};

export function inferImageMimeType(url: string) {
	const normalized = String(url || '').toLowerCase();
	if (normalized.endsWith('.png')) return 'image/png';
	if (normalized.endsWith('.webp')) return 'image/webp';
	if (normalized.endsWith('.gif')) return 'image/gif';
	if (normalized.endsWith('.avif')) return 'image/avif';
	if (normalized.endsWith('.svg')) return 'image/svg+xml';
	return 'image/jpeg';
}

function readUInt16BE(bytes: Uint8Array, offset: number) {
	return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUInt32BE(bytes: Uint8Array, offset: number) {
	return (
		(bytes[offset] << 24) |
		(bytes[offset + 1] << 16) |
		(bytes[offset + 2] << 8) |
		bytes[offset + 3]
	) >>> 0;
}

export function inferImageDimensions(
	buffer: ArrayBuffer,
	mimeType: string
): ImageDimensions | undefined {
	const bytes = new Uint8Array(buffer);
	if (bytes.length < 10) return undefined;

	if (mimeType === 'image/png') {
		if (
			bytes[0] === 0x89 &&
			bytes[1] === 0x50 &&
			bytes[2] === 0x4e &&
			bytes[3] === 0x47 &&
			bytes.length >= 24
		) {
			const width = readUInt32BE(bytes, 16);
			const height = readUInt32BE(bytes, 20);
			if (width && height) return { width, height };
		}
	}

	if (mimeType === 'image/gif') {
		if (
			bytes[0] === 0x47 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes.length >= 10
		) {
			const width = bytes[6] | (bytes[7] << 8);
			const height = bytes[8] | (bytes[9] << 8);
			if (width && height) return { width, height };
		}
	}

	if (mimeType === 'image/webp') {
		if (
			bytes[0] === 0x52 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes[3] === 0x46 &&
			bytes[8] === 0x57 &&
			bytes[9] === 0x45 &&
			bytes[10] === 0x42 &&
			bytes[11] === 0x50
		) {
			const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
			if (chunk === 'VP8X' && bytes.length >= 30) {
				const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
				const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
				if (width && height) return { width, height };
			}
			if (chunk === 'VP8 ' && bytes.length >= 30) {
				const width = bytes[26] | ((bytes[27] & 0x3f) << 8);
				const height = bytes[28] | ((bytes[29] & 0x3f) << 8);
				if (width && height) return { width, height };
			}
			if (chunk === 'VP8L' && bytes.length >= 25) {
				const bits =
					bytes[21] |
					(bytes[22] << 8) |
					(bytes[23] << 16) |
					(bytes[24] << 24);
				const width = (bits & 0x3fff) + 1;
				const height = ((bits >> 14) & 0x3fff) + 1;
				if (width && height) return { width, height };
			}
		}
	}

	if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
		let offset = 2;
		while (offset + 9 < bytes.length) {
			if (bytes[offset] !== 0xff) {
				offset += 1;
				continue;
			}
			const marker = bytes[offset + 1];
			offset += 2;
			if (marker === 0xd8 || marker === 0xd9) continue;
			if (offset + 1 >= bytes.length) break;
			const length = readUInt16BE(bytes, offset);
			if (length < 2 || offset + length > bytes.length) break;
			const isSOF =
				(marker >= 0xc0 && marker <= 0xc3) ||
				(marker >= 0xc5 && marker <= 0xc7) ||
				(marker >= 0xc9 && marker <= 0xcb) ||
				(marker >= 0xcd && marker <= 0xcf);
			if (isSOF && offset + 7 < bytes.length) {
				const height = readUInt16BE(bytes, offset + 3);
				const width = readUInt16BE(bytes, offset + 5);
				if (width && height) return { width, height };
			}
			offset += length;
		}
	}

	return undefined;
}
