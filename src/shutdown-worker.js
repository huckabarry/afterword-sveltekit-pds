export default {
	fetch() {
		return new Response(
			'afterword-sveltekit-pds has been intentionally shut down. Low Velocity sync now runs at https://sync.lowvelocity.org/.',
			{
				status: 410,
				headers: {
					'content-type': 'text/plain; charset=utf-8',
					'cache-control': 'no-store'
				}
			}
		);
	}
};
