
class ThreeJsObject {

    static title = "ThreeJs Object";
    static desc = "Reference to a ThreeJs object";

    constructor() {
        this.addOutput("object", 0);
        // this.widget = this.addWidget("button", "use selected", "", this.applyValue.bind(this));
        // this.widgets_up = true;
        this.properties = {};
        // this.size = [140, 30];
        this._value = null;
    }

    onConfigure(){
        
    }

    setProperties(){
        let accepted_properties = {
            // "position": {type: "vec3", default: new Float32Array(3)}
            // ,"rotation": {type: "vec3", default: new Float32Array(3)}
            // ,"scale": {type: "vec3", default: new Float32Array(3)}
            "position": {type: "3js_Vector3", default: new Float32Array(3), readonly: true}
            ,"rotation": {type: "3js_Vector3", default: new Float32Array(3), readonly: true}
            ,"scale": {type: "3js_Vector3", default: new Float32Array(3), readonly: true}
            ,"id": {type: "number"}
            ,"uuid": {type: "string"}
            ,"name": {type: "string"}
            ,"type": {type: "string"}
            ,"parent": {type: "3js_Object3D"}
            ,"children": {type: "3js_Object3D"}
            ,"up": {type: "3js_Vector3"}
            ,"position": {type: "3js_Vector3"}
            ,"rotation": {type: "Euler"}
            ,"quaternion": {type: "Quaternion"}
            ,"scale": {type: "3js_Vector3"}
            ,"modelViewMatrix": {type: "3js_Matrix4"}
            ,"normalMatrix": {type: "3js_Matrix3"}
            ,"matrix": {type: "3js_Matrix4"}
            ,"matrixWorld": {type: "3js_Matrix4"}
            ,"matrixAutoUpdate": {type: "boolean"}
            ,"matrixWorldNeedsUpdate": {type: "boolean"}
            ,"layers": {type: "3js_Layers"}
            ,"visible": {type: "boolean"}
            ,"castShadow": {type: "boolean"}
            ,"receiveShadow": {type: "boolean"}
            ,"frustumCulled": {type: "boolean"}
            ,"renderOrder": {type: "number"}
            ,"userData": {type: "object"}
        };
        let properties_by_type = {
            "Mesh": {
                "material": {type: "3js_material", default: 0}
            }
            ,"Camera": {
                "aspect": {type: "number", default: 0}
                ,"far": {type: "number", default: 0}
                ,"filmGauge": {type: "number", default: 0}
                ,"filmOffset": {type: "number", default: 0}
                ,"focus": {type: "number", default: 0}
                ,"fov": {type: "number", default: 0}
                ,"frustumCulled": {type: "number", default: 0}
                ,"near": {type: "number", default: 0}
                ,"order": {type: "number", default: 0}
                ,"up": {type: "number", default: 0}
                ,"renderOrder": {type: "number", default: 0}
            }
        };
        if(properties_by_type[obj.type]){
            accepted_properties = Object.assign(accepted_properties, properties_by_type[obj.type]);
        }
        let thisNode = this;
        accepted_properties.forEach((key,value) => {
            const propName = typeof(value)=="object" ? key : value; 
            const propType = typeof(value)=="object" ? value.type : 0; 
            const defValue = typeof(value)=="object" ? value.type : 0; 
            if(typeof(thisNode.properties[propName]) !== "undefined"){
                //
            }else{
                thisNode.addProperty(propName,defValue,propType);
            }
        });
    }

    /*
    onBeforeRender
    onAfterRender
    applyMatrix4
    applyQuaternion
    setRotationFromAxisAngle
    setRotationFromEuler
    setRotationFromMatrix
    setRotationFromQuaternion
    rotateOnAxis
    rotateOnWorldAxis
    rotateX
    rotateY
    rotateZ
    translateOnAxis
    translateX
    translateY
    translateZ
    localToWorld
    worldToLocal
    lookAt
    add
    remove
    attach
    getObjectById
    getObjectByName
    getObjectByProperty
    getWorldPosition
    getWorldQuaternion
    getWorldScale
    getWorldDirection
    raycast
    traverse
    traverseVisible
    traverseAncestors
    updateMatrix
    updateMatrixWorld
    updateWorldMatrix
    toJSON
    clone
    copy
    */

    getTitle() {
        if (this.flags.collapsed) {}
        return this?._value ? this._value.name : "NONE";
    }

    onPropertyChanged(name, value) {
        if(this?._value && typeof(this._value)=="object" && typeof(this._value[name])!=="undefined"){
            console.debug("**threeob**","update property",name,value);
            this._value[name] = value;
        }
    }

    onExecute() {
        this.setOutputData(0,this._value);
        // console.debug(this._value);
    }
}