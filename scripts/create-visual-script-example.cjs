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
export {addRotationStarter} from './source/core/objects/script/LiteGraphStarter.js';
export {RendererConfiguration} from './source/core/renderer/RendererConfiguration.js';
`,{context,identifier:path.join(root,"example-entry.js")});
(async function()
{
	await entry.link((specifier,parent)=>specifier==="three" ? three : load(path.resolve(path.dirname(parent.identifier),specifier)));
	await entry.evaluate();
	const {LGraph,addRotationStarter,RendererConfiguration}=entry.namespace;
	const program = new THREE.Group(); program.type="Program"; program.name="Visual scripting — spin box";
	const scene = new THREE.Scene(); scene.name="Visual script example"; scene.background=new THREE.Color(0x223348); program.add(scene);
	const geometry=new THREE.BoxBufferGeometry(1,1,1); geometry.uuid="11111111-1111-4111-8111-111111111111";
	const material=new THREE.MeshBasicMaterial({color:0x66bbff}); material.uuid="22222222-2222-4222-8222-222222222222";
	const box = new THREE.Mesh(geometry,material); box.uuid="33333333-3333-4333-8333-333333333333"; box.name="Spinning box"; box.matrixAutoUpdate=false; scene.add(box);
	const camera=new THREE.PerspectiveCamera(50,1.5,0.1,100); camera.position.set(4,3,6); camera.lookAt(0,0,0); camera.name="Camera"; scene.add(camera);
	const graph=new LGraph(); addRotationStarter(graph,box.uuid);
	program.updateMatrixWorld(true);
	const data=program.toJSON();
	function normalize(object)
	{
		object.visible=true;
		object.matrixAutoUpdate=object.uuid!==box.uuid;
		object.layers=1;
		for (const child of object.children||[]) normalize(child);
	}
	normalize(data.object);
	Object.assign(data.object,{author:"nunuStudio LiteGraph integration",description:"Scene Events update drives Rotate at one radian per second. The source scene is unchanged during preview.",version:"1.0.0",ar:false,vr:false,vrScale:1,rendererConfig:new RendererConfiguration().toJSON()});
	Object.assign(data.object.children[0],{usePhysics:false,cameras:[camera.uuid]});
	data.object.children[0].children.push({type:"LiteGraphScript",name:"Spin box",uuid:"44444444-4444-4444-8444-444444444444",visible:true,graphVersion:1,graph:graph.serialize()});
	const file=path.join(root,"source/files/examples/visual-script-spin.isp");
	fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n");
	fs.writeFileSync(file.replace(".isp", ".nsp"),Buffer.from(new StaticPair().toArrayBuffer(data)));
	console.log("Wrote JSON and binary examples: "+file);
})().catch((error)=>{console.error(error);process.exitCode=1;});
