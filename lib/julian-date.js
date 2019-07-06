// # julian-date.js
"use strict";

// # JulianDate
// A helper class that doesn't parse a date from a Unix timestamp, but from a 
// Julian date instead.
class JulianDate extends Date {

	// ## constructor(...args)
	constructor(...args) {

		// Handle non-timestamp date constructions.
		if (args.length !== 1 || typeof args[0] !== 'number') {
			super(...args);
			return;
		}

		// Helper variables.
		let n = args[0];
	    let a = n + 32044;
	    let b = Math.floor(((4*a) + 3)/146097);
	    let c = a - Math.floor((146097*b)/4);
	    let d = Math.floor(((4*c) + 3)/1461);
	    let e = c - Math.floor((1461 * d)/4);
	    let f = Math.floor(((5*e) + 2)/153);

	    // Parse day, month year & call super constructor.
	    let D = e + 1 - Math.floor(((153*f) + 2)/5);
	    let M = f + 3 - 12 - Math.round(f/10);
	    let Y = (100*b) + d - 4800 + Math.floor(f/10);
	    super(Y, M, D);

	}

	// ## getJulianDate()
	// Returns the julian timestamp for this date.
	getJulianDate() {
		let d = this;
		let x = Math.floor((14 - d.getMonth())/12);
	    let y = d.getFullYear() + 4800 - x;
	    let z = d.getMonth() - 3 + 12 * x;
	    let n = d.getDate() + Math.floor(((153 * z) + 2)/5) + (365 * y) + Math.floor(y/4) + Math.floor(y/400) - Math.floor(y/100) - 32045;

	    return n;
	}

	// ## valueOf()
	// Override valueOf() so that we return the **julian** date instead of the 
	// timestamp.
	valueOf() {
		return this.getJulianDate();
	}


}
module.exports = JulianDate;