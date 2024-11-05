// # cli-test.js
import { use, expect } from 'chai';
import { Command } from 'commander';
import chaiSpies from 'chai-spies';
import path from 'node:path';
import inquirer from 'inquirer';
import { parseArgsStringToArgv as argv } from 'string-argv';
import resource from '#test/get-test-file.js';
import { factory } from '../setup-cli.js';
import { ZoneType } from 'sc4/core';
const chai = use(chaiSpies);

const action = Command.prototype.action;
beforeEach(function() {
	let ctx = this.currentTest.ctx;
	let instance = ctx.cli = factory(new Command());
	instance.cwd = resource('.');

	// Override the action so that we can save a reference to the action.
	Command.prototype.action = function(fn) {
		return action.call(this, function(...args) {
			return instance._currentCommand = fn.call(this, ...args);
		});
	};

	// Make the cli awaitable when testing.
	instance.then = function(...args) {
		return Promise.resolve(this._currentCommand).then(...args);
	};

	// Create a run method as well.
	ctx.run = function(cmd) {
		let args = ['node', import.meta.resolve('sc4/cli'), ...argv(cmd)];
		this.cli.parse(args);
		return this.cli;
	};

	Object.defineProperty(ctx, 'api', {
		configurable: true,
		get() {
			return this.cli.api;
		},
	});

	Object.defineProperty(ctx, 'cwd', {
		configurable: true,
		get() {
			return this.cli.cwd;
		},
	});

	// Helper for mocking api calls.
	ctx.mock = function(name) {
		return function(fn) {
			let spy = chai.spy(fn);
			this.cli.api = {
				[name]: spy,
			};
			return spy;
		};
	};

	// Helper function for mocking inquirer.
	ctx.prompt = function(answers) {
		inquirer.prompt = async function() {
			return answers;
		};
	};

});

// Restore inquirer after each test.
const prompt = inquirer.prompt;
afterEach(() => inquirer.prompt = prompt);

describe('The historical command', function() {

	beforeEach(function() {
		const ctx = this.currentTest.ctx;
		ctx.mock = ctx.mock('historical');
	});

	it('historical --no-interactive -rci "city.sc4"', async function() {

		// Mock the api.
		this.mock((opts) => {
			expect(opts).to.have.property('dbpf');
			expect(opts.residential).to.be.true;
			expect(opts.commercial).to.be.true;
			expect(opts.industrial).to.be.true;
			expect(opts.agricultural).to.be.undefined;
			expect(opts.save).to.be.true;
			expect(opts.save).to.be.true;
		});

		await this.run(this.test.title);
		expect(this.api.historical).to.have.been.called.once;

	});

	it('historical --no-interactive --all -o "my city.sc4" "city.sc4"', async function() {

		// Mock the api.
		this.mock((opts) => {
			expect(opts).to.have.property('dbpf');
			expect(opts.all).to.be.true;
			expect(opts.residential).to.be.undefined;
			expect(opts.commercial).to.be.undefined;
			expect(opts.commercial).to.be.undefined;
			expect(opts.agricultural).to.be.undefined;
			expect(opts.output).to.equal(path.resolve(this.cwd, 'my city.sc4'));
			expect(opts.save).to.be.true;
		});

		await this.run(this.test.title);
		expect(this.api.historical).to.have.been.called.once;

	});

	it('historical --no-interactive --force -rg "city.sc4"', async function() {

		this.mock(opts => {
			expect(opts.residential).to.be.true;
			expect(opts.agricultural).to.be.true;
			expect(opts.commercial).to.be.undefined;
			expect(opts.industrial).to.be.undefined;
			expect(opts.output).to.equal(path.resolve(this.cwd, 'city.sc4'));
		});

		await this.run(this.test.title);
		expect(this.api.historical).to.have.been.called.once;

	});

	context('in interactive mode', function() {

		it('historical "city.sc4" with all types', async function() {

			// Mock inquirer answers.
			this.prompt({
				types: ['Residential', 'Commercial', 'Agricultural', 'Industrial'],
				ok: true,
				output: 'C:/my-city.sc4',
			});

			// Mock the api.
			this.mock((opts) => {
				expect(opts.residential).to.be.true;
				expect(opts.commercial).to.be.true;
				expect(opts.agricultural).to.be.true;
				expect(opts.industrial).to.be.true;
				expect(opts.output).to.equal(path.normalize('C:/my-city.sc4'));
				expect(opts.save).to.be.true;
			});
			await this.run('historical "city.sc4"');
			expect(this.api.historical).to.have.been.called.once;

		});

		it('historical "city.sc4" with some types', async function() {

			// Mock inquirer answers.
			this.prompt({
				types: ['Residential', 'Industrial'],
				ok: true,
			});

			// Mock the api.
			this.mock((opts) => {
				expect(opts.residential).to.be.true;
				expect(opts.commercial).to.be.undefined;
				expect(opts.agricultural).to.be.undefined;
				expect(opts.industrial).to.be.true;
				expect(opts.save).to.be.true;
			});
			await this.run('historical "city.sc4"');
			expect(this.api.historical).to.have.been.called.once;

		});

	});

});

describe('The growify command', function() {

	beforeEach(function() {
		let ctx = this.currentTest.ctx;
		ctx.mock = ctx.mock('growify');
	});

	it('growify --no-interactive -r Medium -i High "city.sc4"', async function() {

		this.mock(opts => {
			expect(opts.residential).to.equal(ZoneType.RMedium);
			expect(opts.industrial).to.equal(ZoneType.IHigh);
			expect(opts.agricultural).to.be.undefined;
			expect(opts.output).to.equal(path.resolve(this.cwd, 'GROWIFIED-city.sc4'));
			expect(opts.save).to.be.true;
		});

		await this.run(this.test.title);
		expect(this.api.growify).to.have.been.called.once;

	});

	it('growify --no-interactive -g "city.sc4"', async function() {
		this.mock(opts => {
			expect(opts.agricultural).to.equal(ZoneType.ILow);
			expect(opts.output).to.equal(path.resolve(this.cwd, 'GROWIFIED-city.sc4'));
			expect(opts.save).to.be.true;
		});
		await this.run(this.test.title);
		expect(this.api.growify).to.have.been.called.once;
	});

	it('growify --no-interactive -r Low --force city.sc4', async function() {
		this.mock(opts => {
			expect(opts.residential).to.equal(ZoneType.RLow);
			expect(opts.industrial).to.be.undefined;
			expect(opts.agricultural).to.be.undefined;
			expect(opts.output).to.equal(path.resolve(this.cwd, 'city.sc4'));
			expect(opts.save).to.be.true;
		});
		await this.run(this.test.title);
		expect(this.api.growify).to.have.been.called.once;
	});

	it('growify --no-interactive -r High -i Medium city.sc4', async function() {
		this.mock(opts => {
			expect(opts.residential).to.equal(ZoneType.RHigh);
			expect(opts.industrial).to.equal(ZoneType.IMedium);
			expect(opts.agricultural).to.be.undefined;
			expect(opts.output).to.equal(path.resolve(this.cwd, 'GROWIFIED-city.sc4'));
			expect(opts.save).to.be.true;
		});
		await this.run(this.test.title);
		expect(this.api.growify).to.have.been.called.once;
	});

	it('growify --no-interactive -r High --output ../city.sc4 city.sc4', async function() {
		this.mock(opts => {
			expect(opts.residential).to.equal(ZoneType.RHigh);
			expect(opts.industrial).to.be.undefined;
			expect(opts.agricultural).to.be.undefined;
			expect(opts.output).to.equal(path.resolve(this.cwd, '../city.sc4'));
			expect(opts.save).to.be.true;
		});
	});

	context('in interactive mode', function() {

		const cmd = 'growify "city.sc4"';

		it('should pick low-density residentials only', async function() {

			this.prompt({
				types: ['residential'],
				residential: ZoneType.RLow,
				output: 'my-city.sc4',
				ok: true,
			});

			this.mock(opts => {
				expect(opts.residential).to.be.ok;
				expect(opts.residential).to.equal(ZoneType.RLow);
				expect(opts.output).to.equal(path.resolve(this.cwd, 'my-city.sc4'));
				expect(opts.save).to.be.true;
			});

			await this.run(cmd);
			expect(this.api.growify).to.have.been.called.once;

		});

		it('should pick medium-density residentials only', async function() {

			this.prompt({
				types: ['residential'],
				residential: ZoneType.RMedium,
				output: 'my-city.sc4',
				ok: true,
			});

			this.mock(opts => {
				expect(opts.residential).to.be.ok;
				expect(opts.residential).to.equal(ZoneType.RMedium);
				expect(opts.output).to.equal(path.resolve(this.cwd, 'my-city.sc4'));
				expect(opts.save).to.be.true;
			});

			await this.run(cmd);
			expect(this.api.growify).to.have.been.called.once;

		});

		it('should pick high-density residentials only', async function() {

			this.prompt({
				types: ['residential'],
				residential: ZoneType.RHigh,
				ok: true,
			});

			this.mock(opts => {
				expect(opts.residential).to.be.ok;
				expect(opts.residential).to.equal(ZoneType.RHigh);
				expect(opts.output).to.equal(path.resolve(this.cwd, 'GROWIFIED-city.sc4'));
				expect(opts.save).to.be.true;
			});

			await this.run(cmd);
			expect(this.api.growify).to.have.been.called.once;

		});

		it('should force pick agricultural buildings', async function() {
			this.prompt({
				types: ['agricultural'],
				agricultural: true,
				force: true,
			});

			this.mock(opts => {
				expect(opts.agricultural).to.equal(ZoneType.ILow);
				expect(opts.residential).to.be.undefined;
				expect(opts.industrial).to.be.undefined;
				expect(opts.output).to.equal(path.resolve(this.cwd, 'city.sc4'));
				expect(opts.save).to.be.true;
			});

			await this.run(cmd);
			expect(this.api.growify).to.have.been.called.once;

		});

		it('should pick medium-density industrials', async function() {
			this.prompt({
				types: ['industrial'],
				industrial: ZoneType.IMedium,
				ok: true,
				output: '../my-city.sc4',
			});

			this.mock((opts) => {
				expect(opts.residential).to.be.undefined;
				expect(opts.industrial).to.equal(ZoneType.IMedium);
				expect(opts.agricultural).to.be.undefined;
				expect(opts.output).to.equal(path.resolve(this.cwd, '../my-city.sc4'));
				expect(opts.save).to.be.true;
			});
			
			await this.run(cmd);
			expect(this.api.growify).to.have.been.called.once;

		});

		it('should pick high-density industrials', async function() {
			this.prompt({
				types: ['industrial'],
				industrial: ZoneType.IHigh,
				force: true,
			});
			this.mock((opts) => {
				expect(opts.residential).to.be.undefined;
				expect(opts.industrial).to.equal(ZoneType.IHigh);
				expect(opts.agricultural).to.be.undefined;
				expect(opts.output).to.equal(path.resolve(this.cwd, 'city.sc4'));
				expect(opts.save).to.be.true;
			});

			await this.run(cmd);
			expect(this.api.growify).to.have.been.called.once;

		});

		it('should exit if not ok', async function() {

			this.prompt({
				types: ['residential', 'industrial'],
				residential: ZoneType.RLow,
				industrial: ZoneType.RMedium,
				ok: false,
			});
			this.mock();

			await this.run(cmd);
			expect(this.api.growify).to.not.have.been.called();

		});

	});

});
