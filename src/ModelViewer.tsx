import { Environment, GizmoHelper, GizmoViewport, Grid, Html, OrbitControls, useAnimations, } from "@react-three/drei";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { AnimationMixer, Box3, Mesh, PerspectiveCamera, Vector3 } from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/Addons.js";
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import GUI from 'lil-gui';

let modeldet = {
    "name": ""
};

function Model({gltf}: any) {
    const { camera } = useThree();
    const [gltfcur, setGLTFcur] = useState<GLTF | null>(null);
    const group = useRef(null);
    const controlsRef = useRef<OrbitControlsImpl>(null);
    let id: number;
    let wireframe = false;

    useEffect(() => {
        if (gltf) setGLTFcur(gltf);
    }, [gltf]);
    const {actions } = useAnimations(gltf.animations, group);

    useEffect(() => {
        if (!gltfcur) return;
        if (!controlsRef.current) return;
        // setActions(useAnimations(gltfcur.animations, group));

        //Create the GUI
        const gui = new GUI();
        //Css Styling
        gui.domElement.style.left = '0px' //Re-position the GUI

        const newmodel = {
            newmod: async function() {
                var input = document.createElement('input');
                input.type = 'file';

                input.onchange = async (e: any) => {
                    if (!e.target) return;
                    var file = e.target.files[0];
                    console.log("TYPE:", file);
                    var fileurl = URL.createObjectURL(file);
                    try {
                        const loader = new GLTFLoader();
                        const gltf = await loader.loadAsync(fileurl);
                        console.log(gltf)
                        setGLTFcur(gltf);
                    } finally {
                        URL.revokeObjectURL(fileurl)
                    }

                }
                input.click();
            }
        }

        const modeldata = Viewmodelverts(gltfcur);
        gui.add(modeldet, "name").disable();
        gui.add(modeldata, 0).name("Vertices").disable();
        gui.add(modeldata, 2).name("Faces").disable();
        gui.add(newmodel, 'newmod').name("Import new GLB")
        const settingsFolder = gui.addFolder('Settings');
        const set = {
            wireframe: (() => {
                gltfcur.scene.traverse((child) => {
                    if(child instanceof Mesh) {
                        if (Array.isArray(child.material)) {
                            if (wireframe == false) {
                                child.material.forEach(mat => mat.wireframe = true);
                                wireframe = true
                            } else {
                                child.material.forEach(mat => mat.wireframe = false);
                                wireframe = false
                            }
                            
                        } else {
                            if (wireframe == false) {
                                child.material.wireframe = true;
                                wireframe = true
                            } else {
                                child.material.wireframe = false;
                                wireframe = false
                            }
                        }
                    }
                })
            })
        }
        settingsFolder.add(set, 'wireframe').name("Wireframe")

        // Create a bounding box for the imported model.
        const box = new Box3().setFromObject(gltfcur.scene);

        const size = new Vector3();
        const center = new Vector3();

        box.getSize(size);
        box.getCenter(center);

        // Animate and move Camera controls to center of model.
        function animate() {
            id = requestAnimationFrame(animate);
            controlsRef.current!.target.lerp(center, 0.15);
            if (controlsRef.current!.target.distanceTo(center) < 0.001) {
                console.log("STOPP")
                cancelAnimationFrame(id);
            }
        }
        animate();

        // controlsRef.current?.target.copy(center);
        controlsRef.current?.update();

        // Compute radius of bounding sphere
        const maxDim = Math.max(size.x, size.y, size.z);
        const cam = camera as PerspectiveCamera;
        const fov = cam.fov * (Math.PI / 180);
        const distance = maxDim / (2 * Math.tan(fov / 2));

        // position camera relative to center
        camera.position.set(
            center.x,
            center.y,
            center.z + distance * 1.2 // padding factor
        );

        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();


        // Check if GLB has animations
        if (gltfcur.animations && gltfcur.animations.length > 0 ) {
            const mixer = new AnimationMixer(gltfcur.scene);
            const animfolder = gui.addFolder("Animations").close();
            for (const i in gltfcur.animations) { // Traverse through animations and add to GUI folder
                const obj = {
                    play: () => {
                        mixer.stopAllAction();
                        actions[gltfcur.animations[i].name]?.reset().play();
                    }
                }
                animfolder.add(obj, 'play').name(gltfcur.animations[i].name);
            }
        }

        controlsRef.current.update();
    }, [gltfcur, camera]);

    return gltfcur ? (
        <>
            <primitive ref={group} object={gltfcur.scene}/>
            <OrbitControls ref={controlsRef} makeDefault/>
        </>
    ) : null;
}

function Viewmodelverts(gltf: any) {
    const mod = gltf as GLTF;
    let childCount = 0;
    let vertCount = 0;
    let edgeCount = 0;
    let faceCount = 0;

    mod.scene.traverse( function(child) {
        if(child instanceof Mesh) {
            const index = child.geometry.index; // Check if model is indexed.
            vertCount += child.geometry.attributes.position.count;
            faceCount += index ? index.count / 3 : child.geometry.attributes.position.count / 3;
            childCount += 1;
        }
    })
    return [vertCount,edgeCount,faceCount, childCount];
}

function ViewModel() {
    const [fileurl, SetFileurl] = useState(String);
    const gltf = fileurl ? useLoader(GLTFLoader, fileurl) : null;
    var options = ['glb', 'gltf'];

    const handleDrop = (e: any) => {
        e.preventDefault();
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            const fileExt = droppedFiles[0].name.split('.').pop(); // Check the file type that was uploaded.
            if (options.includes(fileExt)) { // Verify that extension is in our options array.
                SetFileurl(URL.createObjectURL(droppedFiles[0]));
                modeldet.name = droppedFiles[0].name;
            } else {
                window.alert("Invalid file.")
            }
        }
    };

    const handleDragOver = (e: any) => {
        e.preventDefault();
    };
    
    return (
        <>
            <div 
            style={{width: "100%", height: "100%", position: "absolute", top: "0", left: "0"}}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            >
                <Canvas 
                shadows 
                color="#000000"
                camera={{setRotationFromEuler: 5, position: [0,1,0],fov: 50}}
                >
                    <Environment near={1} far={1000} resolution={256} preset="city"/>
                    <GizmoHelper alignment="top-right" margin={[80, 80]}>
                        <GizmoViewport axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
                    </GizmoHelper>
                    <Grid infiniteGrid={true} cellSize={0.5} cellColor={"black"} sectionColor={"grey"}/>
                    {gltf ? (
                        <Model gltf={gltf}/>
                    ) : ( 
                        <Html center>
                            <div style={{padding: "10px",textWrap: "nowrap", backgroundColor: "rgba(0, 0, 0, 0.56)", width: "500px", display: "flex", flexDirection: "column"}}>
                                <div style={{borderStyle: "dotted", padding: "80px", color: "white", display: "flex", justifyContent: "center"}}>
                                    <p>Drag and drop .glb/gltf</p>
                                </div>
                                <div style={{
                                    display: "flex", 
                                    // backgroundColor: "rgba(0, 0, 0, 0.36)", 
                                    width: "100%", 
                                    justifyContent: "space-between",
                                    alignSelf: "center"
                                    }}>
                                    <p style={{color: "white"}}>Developed by Oliver</p>
                                    <p style={{color: "white"}}>Github</p>
                                </div>
                            </div>
                        </Html>
                    )}
                </Canvas>
            </div>
        </>
    )
}

export function ModelViewer() {
    return(
        <>
            <ViewModel/>
        </>
    )
}