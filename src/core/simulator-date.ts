// # simulator-date.ts
import { getJulianFromUnix, getUnixFromJulian } from 'sc4/utils';

// Epoch is 2000-01-01T12:00:00Z, which is 946728000000 as unix timestamp, and 
// 245154 as julian date.
const epochUnix = 946728000000;
const epochJulian = 245154;

type SimulatorDateOptions = {
	unix: number;
	julian: number;
	year?: number;
	month?: number;
	day?: number;
};

type WithOptions = {
	year?: number;
	month?: number;
	day?: number;
};

// # SimulatorDate
// This class helps us work with dates in the game. JavaScript's builtin date is 
// not flexible enough for this, and temporal isn't ready for production yet, so 
// we implement the logic ourselves. We will inspired ourselves on temporal 
// though, meaning that evrything is functional. Nothing is modified by 
// reference! Also note that we don't need any hour logic.
export default class SimulatorDate {
	year = 2000;
	month = 1;
	day = 1;
	unix = epochUnix;
	julian = epochJulian;
	static fromJulian(julian: number) {
		let unix = getUnixFromJulian(julian);
		return new SimulatorDate({ unix, julian });
	}

	static fromUnix(timestamp: number) {
		let julian = getJulianFromUnix(timestamp);
		return new SimulatorDate({ julian, unix: timestamp });
	}

	static fromYearMonthDay(year: number, month: number, day: number) {
		let unix = getDate(year, month, day).getTime();
		let julian = getJulianFromUnix(unix);
		return new SimulatorDate({ unix, julian, year, month, day });
	}

	// ## epoch()
	static epoch() {
		return new SimulatorDate({
			year: 2000,
			month: 1,
			day: 1,
			unix: epochUnix,
			julian: epochJulian,
		});
	}

	// ## constructor()
	// The constructor is not meant to be used publicly, use the static `.from` 
	// methods instead!
	private constructor(opts: SimulatorDateOptions) {
		let { unix, julian, year, month, day } = opts;
		this.unix = unix;
		this.julian = julian;
		if (year === undefined || month === undefined || day === undefined) {
			({ year, month, day } = getYmd(new Date(this.unix)));
		}
		this.year = year;
		this.month = month;
		this.day = day;
	}

	// ## toJulian()
	toJulian() {
		return this.julian;
	}

	// ## with(opts)
	with(opts: WithOptions): SimulatorDate {
		let {
			year = this.year,
			month = this.month,
			day = this.day,
		} = opts;
		return SimulatorDate.fromYearMonthDay(year, month, day);
	}

	// # add(opts)
	add(opts: { years?: number, months?: number, days?: number }): SimulatorDate {
		let date = new SimulatorDate({ ...this });
		let { years, months, days } = opts;
		if (years !== undefined) {
			date = date.with({ year: date.year + years });
		}
		if (months !== undefined) {
			let next = date.month + months;
			let deltaYears = Math.trunc(next / 12);
			let month = (next % 12) || 12;
			date = date.with({ year: date.year+deltaYears, month });
		}
		if (days !== undefined) {
			date = SimulatorDate.fromJulian(date.julian + days);
		}
		return date;
	}

	[Symbol.for('nodejs.util.inspect.custom')](_level: any, util: any) {
		let { year } = this;
		let month = String(this.month).padStart(2, '0');
		let day = String(this.day).padStart(2, '0');
		return util.stylize(`${year}-${month}-${day}`, 'date');
	}

	[Symbol.toPrimitive]() {
		return this.unix;
	}

}

// # getYmd(date)
// Extracts the year, date and month from a JS date.
function getYmd(date: Date) {
	let year = date.getUTCFullYear();
	let month = date.getUTCMonth()+1;
	let day = date.getUTCDate();
	return { year, month, day };
}

// # getDate()
// Helper function for easily returning a standard js date, given year, month 
// and day.
function getDate(year: number, month: number, day: number) {
	let date = emptyDate();
	date.setUTCFullYear(year);

	// JS dates count from 0.
	date.setUTCMonth(month-1);
	date.setUTCDate(day);
	return date;
}

function emptyDate() {
	return new Date(epochUnix);
}
