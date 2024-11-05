// # julian-date.js
'use strict';
exports.getUnixFromJulian = getUnixFromJulian;
exports.getJulianFromUnix = getJulianFromUnix;

// Julian day offset between unix epoch and Julian Date 0.
const OFFSET = 2440587.5;

// Milliseconds in a day.
const MS_DAY = 60*60*24*1000;

// # getUnixFromJulian(d)
function getUnixFromJulian(d) {
	return (d - OFFSET) * MS_DAY;
}

// # getJulianFromUnix(ms)
function getJulianFromUnix(ms) {
	return ms/MS_DAY + OFFSET;
}
