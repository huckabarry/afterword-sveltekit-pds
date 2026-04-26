/**
 * @template T
 * @param {T[]} data
 * @param {{ page?: number; limit?: number }} [options]
 */
export function paginate(data, { page = 1, limit } = {}) {
	if (limit) {
		return data.slice((page - 1) * limit, page * limit);
	}

	return data;
}
