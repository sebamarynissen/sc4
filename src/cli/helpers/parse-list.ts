// # parse-list.js
// Helper function that parses a list from an input string based on spaces or 
// commas as separators.
export default function parseStringToArray(input: string) {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;
	let escapeNext = false;
	for (let i = 0; i < input.length; i++) {
		const char = input[i];

		if (escapeNext) {
			current += char;
			escapeNext = false;
		} else if (char === '\\') {
			escapeNext = true;
		} else if (char === '"') {
			inQuotes = !inQuotes;
		} else if (!inQuotes && (char === ' ' || char === ',')) {

			// If outside quotes and encounter a separator, push current and 
			// reset.
			if (current.trim() !== '') {
				result.push(current.trim());
			}
			current = '';

		} else {
			// Add character to current element
			current += char;
		}
	}

	// Add the last element if it exists
	if (current.trim() !== '') {
		result.push(current.trim());
	}
	return result;
}
