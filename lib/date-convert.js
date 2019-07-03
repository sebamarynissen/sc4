// # date-convert.js
// Converts JavaScript dates to Julian date ints. See
// https://stackoverflow.com/questions/26370688 for more info.
"use strict";

// # toDate(n)
// Converts a Julian date n (which is assumed to be an integer) to a 
// JavaScript date.
exports.toDate = function julianIntToDate(n) {
	
	// Helper variables.
    let a = n + 32044;
    let b = Math.floor(((4*a) + 3)/146097);
    let c = a - Math.floor((146097*b)/4);
    let d = Math.floor(((4*c) + 3)/1461);
    let e = c - Math.floor((1461 * d)/4);
    let f = Math.floor(((5*e) + 2)/153);

    // Parse day, month year.
    let D = e + 1 - Math.floor(((153*f) + 2)/5);
    let M = f + 3 - 12 - Math.round(f/10);
    let Y = (100*b) + d - 4800 + Math.floor(f/10);

    return new Date(Y,M,D);

};

// # toJulianDate(date)
// Converts a JavaScript date to a julian date.
exports.toJulianDate = function(d) {
	
    let x = Math.floor((14 - d.getMonth())/12);
    let y = d.getFullYear() + 4800 - x;
    let z = d.getMonth() - 3 + 12 * x;
    let n = d.getDate() + Math.floor(((153 * z) + 2)/5) + (365 * y) + Math.floor(y/4) + Math.floor(y/400) - Math.floor(y/100) - 32045;

    return n;

};