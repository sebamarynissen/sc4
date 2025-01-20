// # dependency-tracker-test.ts
import fs from 'node:fs';
import path from 'node:path';
import { output } from '#test/files.js';
import DependencyTracker from '../dependency-tracker.js';
import { DBPF, Exemplar, ExemplarProperty, FileType, LotObject, TGI } from 'sc4/core';
import { randomId } from 'sc4/utils';
import { expect } from 'chai';

describe('#DependencyTracker', function() {

	async function setup() {
		let folder = output('deps');
		await fs.promises.rm(folder, { recursive: true, force: true });
		let installation = path.join(folder, 'installation');
		let plugins = path.join(folder, 'plugins');
		await fs.promises.mkdir(installation, { recursive: true });
		await fs.promises.mkdir(plugins, { recursive: true });
		return { installation, plugins };
	}

	it('tracks dependencies starting from a lot', async function() {

		let { installation, plugins } = await setup();

		let model = new DBPF();
		let modelTGI = TGI.random(FileType.S3D);
		model.add(modelTGI, new Uint8Array());
		model.save(path.join(plugins, 'model.SC4Model'));

		let building = new DBPF();
		let buildingExemplar = new Exemplar();
		buildingExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.Buildings);
		buildingExemplar.addProperty('ResourceKeyType0', [...modelTGI]);
		buildingExemplar.addProperty('ExemplarName', 'Building name');
		building.add(TGI.random(FileType.Exemplar), buildingExemplar);
		building.save(path.join(plugins, 'building.SC4Desc'));

		let lot = new DBPF();
		let lotExemplar = new Exemplar();
		lotExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.LotConfigurations);
		lotExemplar.addProperty('ExemplarName', 'Lot name');
		lotExemplar.lotObjects.push(
			new LotObject({
				type: LotObject.Building,
				IID: building.entries[0]!.instance,
			}),
		);
		lot.add(TGI.random(FileType.Exemplar, 0xa8fbd372), lotExemplar);
		lot.save(path.join(plugins, 'lot.SC4Lot'));

		let tracker = new DependencyTracker({
			installation,
			plugins,
		});
		let result = await tracker.track(plugins) as any;
		let { tree } = result;
		expect(tree).to.have.length(1);
		expect(tree[0].kind).to.equal('lot');
		expect(tree[0].entry.instance).to.equal(lot.entries[0].instance);
		expect(tree[0].building.kind).to.equal('exemplar');
		expect(tree[0].building.name).to.equal('Building name');
		expect(tree[0].building.models).to.have.length(1);
		expect(tree[0].building.models[0].kind).to.equal('model');

	});

	it('handles QueryExemplarGUID with the same IID as the building exemplar', async function() {

		let { installation, plugins } = await setup();
		let model = new DBPF();
		let modelTGI = TGI.random(FileType.S3D);
		model.add(modelTGI, new Uint8Array());
		model.save(path.join(plugins, 'model.SC4Model'));

		let building = new DBPF();
		let buildingExemplar = new Exemplar();
		let tgi = TGI.random(FileType.Exemplar)
		buildingExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.Buildings);
		buildingExemplar.addProperty('ResourceKeyType0', [...modelTGI]);
		buildingExemplar.addProperty('ExemplarName', 'Building name');
		buildingExemplar.addProperty('QueryExemplarGUID', tgi.instance);
		building.add(tgi, buildingExemplar);
		building.save(path.join(plugins, 'building.SC4Desc'));

		let lot = new DBPF();
		let lotExemplar = new Exemplar();
		lotExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.LotConfigurations);
		lotExemplar.addProperty('ExemplarName', 'Lot name');
		lotExemplar.lotObjects.push(
			new LotObject({
				type: LotObject.Building,
				IID: building.entries[0]!.instance,
			}),
		);
		lot.add(TGI.random(FileType.Exemplar, 0xa8fbd372), lotExemplar);
		lot.save(path.join(plugins, 'lot.SC4Lot'));

		let tracker = new DependencyTracker({
			installation,
			plugins,
		});
		let result = await tracker.track(plugins) as any;
		let { tree } = result;
		expect(tree).to.have.length(1);
		expect(tree[0].kind).to.equal('lot');
		expect(tree[0].entry.instance).to.equal(lot.entries[0].instance);
		expect(tree[0].building.kind).to.equal('exemplar');
		expect(tree[0].building.name).to.equal('Building name');
		expect(tree[0].building.models).to.have.length(1);
		expect(tree[0].building.models[0].kind).to.equal('model');
		expect(tree[0].building.props[0][1].kind).to.equal('missing');

	});

	it('does not track props added to a Maxis family as dependencies (#77)', async function() {

		let { installation, plugins } = await setup();
		let family = randomId();
		let coreFile = new DBPF();
		let coreExemplar = new Exemplar();
		coreExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.Prop);
		coreExemplar.addProperty('BuildingpropFamily', [family]);
		coreFile.add(TGI.random(FileType.Exemplar), coreExemplar);
		coreFile.save(path.join(installation, 'SimCity_1.dat'));

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
			installation,
			plugins,
		});
		let result = await tracker.track(path.join(plugins, 'lot.SC4Lot'));
		expect(result.files).to.have.length(1);
		expect(result.files[0]).to.not.include('props.dat');

	});

	it('does not track props that override Maxis props (#77)', async function() {

		let { installation, plugins } = await setup();

		let tgi = TGI.random(FileType.Exemplar);
		let coreFile = new DBPF();
		let coreExemplar = new Exemplar();
		coreExemplar.addProperty('ExemplarType', ExemplarProperty.ExemplarType.Prop);
		coreFile.add(tgi, coreExemplar);
		coreFile.save(path.join(installation, 'SimCity_1.dat'));

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
			installation: installation,
			plugins,
		});
		let result = await tracker.track(path.join(plugins, 'lot.SC4Lot'));
		expect(result.files).to.have.length(1);
		expect(result.files[0]).to.not.include('props.dat');

	});

});
