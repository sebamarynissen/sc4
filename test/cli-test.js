// # cli-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-spies'));
const path = require('path');
const commander = require('commander');
const inquirer = require('inquirer');
const argv = require('string-argv').default;

const cli = require('../bin/cli');

beforeEach(function() {
	let ctx = this.currentTest.ctx;
	let instance = ctx.cli = cli();
	instance.cwd = path.join(__dirname, 'files');

	// Create a run method as well.
	ctx.run = function(cmd) {
		let args = ['node', require.resolve('../bin/cli'), ...argv(cmd)];
		this.cli.parse(args);
		return this.cli;
	};

	Object.defineProperty(ctx, 'api', {
		"configurable": true,
		get() {
			return this.cli.api;
		}
	});

	// Helper for mocking api calls.
	ctx.mock = function(name) {
		return function(fn) {
			let spy = chai.spy(fn);
			this.cli.api = {
				[name]: spy
			}
			return spy;
		}
	};

});

describe('The historical command should parse options', function() {

	beforeEach(function() {
		let ctx = this.currentTest.ctx;
		ctx.mock = this.mock('historical');
	});

	it('--no-interactive historical "city.sc4" -rci', async function() {

		// Mock the api.
		let dbpf;
		this.mock(function(opts) {
			dbpf = opts.dbpf;
			expect(opts).to.have.property('dbpf');
			expect(opts.residential).to.be.true;
			expect(opts.commercial).to.be.true;
			expect(opts.industrial).to.be.true;
			expect(opts).to.not.have.property('agricultural');
		});

		await this.run(this.test.title);
		expect(this.api.historical).to.have.been.called.once;

	});

	it('--no-interactive historical "city.sc4" --all', async function() {

		// Mock the api.
		this.mock(function(opts) {
			expect(opts).to.have.property('dbpf');
			expect(opts.all).to.be.true;
			expect(opts).to.not.have.property('residential');
			expect(opts).to.not.have.property('commercial');
			expect(opts).to.not.have.property('industrial');
			expect(opts).to.not.have.property('agricultural');
		});

		await this.run(this.test.title);
		expect(this.api.historical).to.have.been.called.once;

	});

});