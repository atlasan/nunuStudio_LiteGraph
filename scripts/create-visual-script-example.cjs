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
		const actor=example.id==="camera"?camera:example.id==="light"?light:box;
		addVisualScriptExample(graph,example.id,actor.uuid);
		program.updateMatrixWorld(true);
		const data=program.toJSON();
		function normalize(object)
		{
			object.visible=true;object.matrixAutoUpdate=object.uuid!==box.uuid;object.layers=1;
			for(const child of object.children||[])normalize(child);
		}
		normalize(data.object);
		Object.assign(data.object,{author:"nunuStudio LiteGraph integration",description:example.description,version:"1.0.0",ar:false,vr:false,vrScale:1,rendererConfig:new RendererConfiguration().toJSON()});
		Object.assign(data.object.children[0],{usePhysics:false,cameras:[camera.uuid]});
		data.object.children[0].children.push({type:"LiteGraphScript",name:example.title,uuid:"44444444-4444-4444-8444-444444444444",visible:true,graphVersion:1,graph:graph.serialize()});
		const file=path.join(folder,"visual-script-"+example.id+".isp");
		fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n");fs.writeFileSync(file.replace(".isp",".nsp"),Buffer.from(new StaticPair().toArrayBuffer(data)));
	}
	fs.writeFileSync(path.join(folder,"visual-script-catalog.json"),JSON.stringify({version:1,nodes:getNunuNodeCatalog()},null,2)+"\n");
	fs.writeFileSync(path.join(folder,"visual-script-examples.json"),JSON.stringify({version:1,examples:examples.map(example=>({...example,json:"visual-script-"+example.id+".isp",binary:"visual-script-"+example.id+".nsp"}))},null,2)+"\n");
	console.log("Wrote "+examples.length+" JSON/binary examples and the node catalog");
})().catch((error)=>{console.error(error);process.exitCode=1;});
