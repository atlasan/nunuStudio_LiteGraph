/* Reproduce the portable sample using the vendored library and Three.js. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const THREE = require("three");
const {StaticPair} = require("@as-com/pson");
const root = path.resolve(__dirname,"..");
const context = vm.createContext({console,performance,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,fetch,URL,Blob,Buffer});
const modules = new Map();
const three = new vm.SyntheticModule(Object.keys(THREE),function()
{
	for (const [key,value] of Object.entries(THREE)) this.setExport(key,value);
},{context});
function load(file)
{
	if (!modules.has(file)) modules.set(file,new vm.SourceTextModule(fs.readFileSync(file,"utf8"),{context,identifier:file,importModuleDynamically:(specifier)=>import(specifier)}));
	return modules.get(file);
}
const entry = new vm.SourceTextModule(`
export {LGraph} from './source/lib/litegraph.js';
export {getNunuExampleCatalog,addVisualScriptExample} from './source/core/objects/script/LiteGraphStarter.js';
export {getNunuNodeCatalog} from './source/core/objects/script/LiteGraphNodeCatalog.js';
export {RendererConfiguration} from './source/core/renderer/RendererConfiguration.js';
`,{context,identifier:path.join(root,"example-entry.js")});
/** A short 660 Hz beep as an 8-bit mono WAV, so the sound example needs no external asset. */
function beepWav()
{
	const rate=11025,samples=Math.round(rate*0.2),data=Buffer.alloc(samples);
	for(let i=0;i<samples;i++)
	{
		const envelope=Math.min(1,i/200,(samples-i)/600);
		data[i]=128+Math.round(90*envelope*Math.sin(2*Math.PI*660*i/rate));
	}
	const header=Buffer.alloc(44);
	header.write("RIFF",0);header.writeUInt32LE(36+samples,4);header.write("WAVE",8);
	header.write("fmt ",12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
	header.writeUInt32LE(rate,24);header.writeUInt32LE(rate,28);header.writeUInt16LE(1,32);header.writeUInt16LE(8,34);
	header.write("data",36);header.writeUInt32LE(samples,40);
	return Buffer.concat([header,data]).toString("base64");
}
function findObject(object,uuid)
{
	if(object.uuid===uuid)return object;
	for(const child of object.children||[]){const found=findObject(child,uuid);if(found)return found;}
	return null;
}
/** Plain three.js stand-ins become nunu physics bodies when saved (cannon-es: dynamic 1, static 2, box shape 4). */
function physicsBody(type,mass,halfExtents)
{
	return {type,mass,linearDamping:0.01,angularDamping:0.01,allowSleep:true,sleepSpeedLimit:0.1,sleepTimeLimit:1,collisionFilterGroup:1,collisionFilterMask:-1,fixedRotation:type===1,shapes:[{type:4,halfExtents}]};
}
(async function()
{
	await entry.link((specifier,parent)=>specifier==="three" ? three : load(path.resolve(path.dirname(parent.identifier),specifier)));
	await entry.evaluate();
	const {LGraph,getNunuExampleCatalog,addVisualScriptExample,getNunuNodeCatalog,RendererConfiguration}=entry.namespace;
	const folder=path.join(root,"source/files/examples"); fs.mkdirSync(folder,{recursive:true});
	const examples=getNunuExampleCatalog();
	for(const example of examples)
	{
		const program=new THREE.Group();program.type="Program";program.name="Visual scripting — "+example.title;program.uuid="00000000-0000-4000-8000-000000000001";
		const scene=new THREE.Scene();scene.name="Visual script example";scene.uuid="00000000-0000-4000-8000-000000000002";scene.background=new THREE.Color(0x223348);program.add(scene);
		const geometry=new THREE.BoxBufferGeometry(1,1,1);geometry.uuid="11111111-1111-4111-8111-111111111111";
		const material=new THREE.MeshStandardMaterial({color:0x66bbff,roughness:0.6,metalness:0.1});material.uuid="22222222-2222-4222-8222-222222222222";
		const box=new THREE.Mesh(geometry,material);box.uuid="33333333-3333-4333-8333-333333333333";box.name="Spinning box";box.matrixAutoUpdate=false;scene.add(box);
		const camera=new THREE.PerspectiveCamera(50,1.5,0.1,100);camera.uuid="00000000-0000-4000-8000-000000000003";camera.position.set(4,3,6);camera.lookAt(0,0,0);camera.name="Camera";scene.add(camera);
		const light=new THREE.DirectionalLight(0xffffff,0.7);light.uuid="00000000-0000-4000-8000-000000000004";light.shadow.camera.uuid="00000000-0000-4000-8000-000000000006";light.name="Key light";light.position.set(3,5,2);scene.add(light);
		const ambient=new THREE.AmbientLight(0xffffff,0.4);ambient.uuid="00000000-0000-4000-8000-000000000005";ambient.name="Ambient light";scene.add(ambient);
		const graph=new LGraph();graph.id="55555555-5555-4555-8555-555555555555";
		let actor=example.id==="camera"?camera:example.id==="light"?light:box;
		const patches=[];
		if(example.id==="jump")
		{
			const ground=new THREE.Group();ground.uuid="66666666-6666-4666-8666-000000000001";ground.name="Ground body";ground.position.set(0,-1,0);scene.add(ground);
			const groundGeometry=new THREE.BoxBufferGeometry(8,0.2,8);groundGeometry.uuid="66666666-6666-4666-8666-000000000002";
			const groundMaterial=new THREE.MeshStandardMaterial({color:0x445566,roughness:0.9});groundMaterial.uuid="66666666-6666-4666-8666-000000000003";
			const floor=new THREE.Mesh(groundGeometry,groundMaterial);floor.uuid="66666666-6666-4666-8666-000000000004";floor.name="Ground";ground.add(floor);
			const player=new THREE.Group();player.uuid="66666666-6666-4666-8666-000000000005";player.name="Physics box";player.position.set(0,1,0);scene.add(player);player.add(box);
			actor=player;
			patches.push([ground.uuid,{type:"Physics",mode:100,body:physicsBody(2,0,{x:4,y:0.1,z:4})}],[player.uuid,{type:"Physics",mode:100,body:physicsBody(1,1,{x:0.5,y:0.5,z:0.5})}]);
		}
		else if(example.id==="sound")
		{
			const emitter=new THREE.Object3D();emitter.uuid="66666666-6666-4666-8666-000000000006";emitter.name="Beep";scene.add(emitter);
			actor=emitter;
			patches.push([emitter.uuid,{type:"Audio",audio:"66666666-6666-4666-8666-000000000007",volume:1,autoplay:false,startTime:0,playbackRate:1,loop:false}]);
		}
		else if(example.id==="animation")
		{
			const clip=new THREE.AnimationClip("Bob",2,[new THREE.VectorKeyframeTrack(".position",[0,1,2],[0,0,0,0,1,0,0,0,0]),new THREE.NumberKeyframeTrack(".rotation[y]",[0,2],[0,Math.PI])]);
			clip.uuid="66666666-6666-4666-8666-000000000008";
			patches.push([box.uuid,{animations:[{...THREE.AnimationClip.toJSON(clip),enabled:true,loop:THREE.LoopRepeat,timeScale:1,weight:1}]}]);
		}
		addVisualScriptExample(graph,example.id,actor.uuid);
		program.updateMatrixWorld(true);
		const data=program.toJSON();
		function normalize(object)
		{
			// The box is static unless an animation moves it.
			object.visible=true;object.matrixAutoUpdate=object.uuid!==box.uuid||example.id==="animation";object.layers=1;
			for(const child of object.children||[])normalize(child);
		}
		normalize(data.object);
		for(const [uuid,fields] of patches)Object.assign(findObject(data.object,uuid),fields);
		delete data.animations;
		if(example.id==="sound")data.audio=[{name:"beep.wav",uuid:"66666666-6666-4666-8666-000000000007",type:"Audio",encoding:"wav",format:"base64",data:beepWav()}];
		Object.assign(data.object,{author:"nunuStudio LiteGraph integration",description:example.description,version:"1.0.0",ar:false,vr:false,vrScale:1,rendererConfig:new RendererConfiguration().toJSON()});
		Object.assign(data.object.children[0],{usePhysics:example.id==="jump",cameras:[camera.uuid]});
		// The loader expects the full world block a saved scene carries (cannon-es solver defaults).
		if(example.id==="jump")data.object.children[0].world={gravity:{x:0,y:-9.8,z:0},quatNormalizeSkip:0,quatNormalizeFast:false,solver:{tolerance:1e-7,iterations:10}};
		data.object.children[0].children.push({type:"LiteGraphScript",name:example.title,uuid:"44444444-4444-4444-8444-444444444444",visible:true,graphVersion:1,graph:graph.serialize()});
		const file=path.join(folder,"visual-script-"+example.id+".isp");
		fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n");fs.writeFileSync(file.replace(".isp",".nsp"),Buffer.from(new StaticPair().toArrayBuffer(data)));
	}
	fs.writeFileSync(path.join(folder,"visual-script-catalog.json"),JSON.stringify({version:1,nodes:getNunuNodeCatalog()},null,2)+"\n");
	fs.writeFileSync(path.join(folder,"visual-script-examples.json"),JSON.stringify({version:1,examples:examples.map(example=>({...example,json:"visual-script-"+example.id+".isp",binary:"visual-script-"+example.id+".nsp"}))},null,2)+"\n");
	console.log("Wrote "+examples.length+" JSON/binary examples and the node catalog");
})().catch((error)=>{console.error(error);process.exitCode=1;});
