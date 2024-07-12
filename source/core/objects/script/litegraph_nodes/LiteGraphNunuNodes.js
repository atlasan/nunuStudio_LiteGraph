import { Editor } from "../../../../editor/Editor";

class NunuObject {

    static title = "Nunu Object";
    static desc = "Reference to a Nunu object";

    constructor() {
        this.addOutput("object", 0);
        this.widget = this.addWidget("button", "use selected", "", this.applyValue.bind(this));
        this.widgets_up = true;
        this.properties = {nunu_uuid: null};
        this.size = [140, 30];
        this._value = null;
    }

    applyValue() {
        this._value = Editor && Editor.selection && Editor.selection.length
            ? Editor.selection[0]
            : null;
        if(this._value && this._value.uuid){
            this.properties.nunu_uuid = this._value.uuid;
        }else{
            this.properties.nunu_uuid = false;
        }
        this.setOutputData(0,this._value);
    }

    onConfigure(){
        const act_uuid = this._value && this._value.uuid ? this._value.uuid : null;
        console.info("**nununode**","nunu node, verify uuid",act_uuid,this.properties.nunu_uuid,this);
        if(this.properties.nunu_uuid !== act_uuid){
            this.refreshObjectByUUID();
        }
    }

    refreshObjectByUUID(){
        if(this.graph && this.graph.nunu_lgscript){
            const scene = this.graph.nunu_lgscript.getScene();
            console.info("**nununode**","got nunu scene",scene);
            const obj = scene.getObjectByUUID(this.properties.nunu_uuid);
            this._value = obj;
            console.info("**nununode**","got nunu obj by UUID",obj);
        }else{
            console.error("**nununode**","no LG graph to get obj",this.graph);
        }
        // getObjectByUUID
    }

    getTitle() {
        if (this.flags.collapsed) {}
        return this._value ? this._value.name : "NONE";
    }

    onPropertyChanged(name, value) {
    }

    onExecute() {
        this.setOutputData(0,this._value);
        // console.debug(this._value);
    }
}
LiteGraph.registerNodeType("nunu/object", NunuObject);


class NunuPosition {

    static title = "Position";
    static desc = "Set nunu object position";

    constructor() {
        this.addInput("object", "object");
        this.addInput("vec3", "vec3");
        this.widgets_up = true;
        this.size = [140, 30];
        this.object = null;
        this.vec3 = null;
    }
    onExecute() {
        this.object = this.getInputData(0);
        this.vec3 = this.getInputData(1);
        if(!this.object || !this.vec3 || this.vec3.length !== 3){
            console.info("**nunuposition**","missing something",this.object,this.vec3);
            return;
        }
        console.info("**nunuposition**","set for object",this.object,this.vec3);
        // this.object?.position.set({x:this.vec3[0], y:this.vec3[1], z:this.vec3[2]});
        this.object?.position.set(this.vec3[0], this.vec3[1], this.vec3[2]);
    }
}
LiteGraph.registerNodeType("nunu/position", NunuPosition);


export {NunuObject, NunuPosition};