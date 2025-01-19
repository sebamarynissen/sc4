// # dependency-tracker-test.ts
import fs from 'node:fs';
import path from 'node:path';
import { output } from '#test/files.js';
import DependencyTracker from '../dependency-tracker.js';
import { DBPF, Exemplar, ExemplarProperty, FileType, LotObject, TGI } from 'sc4/core';
import { randomId } from 'sc4/utils';
import { expect } from 'chai';

describe('#DependencyTracker', function() {

	it('does not track props added to a Maxis family as dependencies (#77)', async function() {

		let folder = output('deps');
		await fs.promises.rm(folder, { recursive: true, force: true });
		let core = path.join(folder, 'core');
		let plugins = path.join(folder, 'plugins');
		await fs.promises.mkdir(core, { recursive: true });
		await fs.promises.mkdir(plugins, { recursive: true });

		let family = randomId();
		let coreFile = new DBPF();
		let coreExemplar = new Exemplar();
		coreExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.Prop);
		coreExemplar.addProperty('BuildingpropFamily', [family]);
		coreFile.add(TGI.random(FileType.Exemplar), coreExemplar);
		coreFile.save(path.join(core, 'SimCity_1.dat'));

		let pluginFile = new DBPF();
		let pluginExemplar = new Exemplar();
		pluginExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.Prop);
		pluginExemplar.addProperty('BuildingpropFamily', [family]);
		pluginFile.add(TGI.random(FileType.Exemplar), pluginExemplar);
		pluginFile.save(path.join(plugins, 'props.dat'));

		let lot = new DBPF();
		let lotExemplar = new Exemplar();
		lotExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.LotConfigurations);
		lotExemplar.lotObjects = [new LotObject({
			type: LotObject.Prop,
			IID: family,
		})];
		lot.add(TGI.random(FileType.Exemplar, 0xa8fbd372), lotExemplar);
		lot.save(path.join(plugins, 'lot.SC4Lot'));

		let tracker = new DependencyTracker({
			installation: core,
			plugins,
		});
		let result = await tracker.track(path.join(plugins, 'lot.SC4Lot'));
		expect(result.files).to.have.length(1);
		expect(result.files[0]).to.not.include('props.dat');

	});

	it('does not track props that override Maxis props (#77)', async function() {

		let folder = output('deps');
		await fs.promises.rm(folder, { recursive: true, force: true });
		let core = path.join(folder, 'core');
		let plugins = path.join(folder, 'plugins');
		await fs.promises.mkdir(core, { recursive: true });
		await fs.promises.mkdir(plugins, { recursive: true });

		let tgi = TGI.random(FileType.Exemplar);
		let coreFile = new DBPF();
		let coreExemplar = new Exemplar();
		coreExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.Prop);
		coreFile.add(tgi, coreExemplar);
		coreFile.save(path.join(core, 'SimCity_1.dat'));

		let pluginFile = new DBPF();
		let pluginExemplar = new Exemplar();
		pluginExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.Prop);
		pluginFile.add(tgi, pluginExemplar);
		pluginFile.save(path.join(plugins, 'props.dat'));

		let lot = new DBPF();
		let lotExemplar = new Exemplar();
		lotExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.LotConfigurations);
		lotExemplar.lotObjects = [new LotObject({
			type: LotObject.Prop,
			IID: tgi.instance,
		})];
		lot.add(TGI.random(FileType.Exemplar, 0xa8fbd372), lotExemplar);
		lot.save(path.join(plugins, 'lot.SC4Lot'));

		let tracker = new DependencyTracker({
			installation: core,
			plugins,
		});
		let result = await tracker.track(path.join(plugins, 'lot.SC4Lot'));
		expect(result.files).to.have.length(1);
		expect(result.files[0]).to.not.include('props.dat');

	});

});
