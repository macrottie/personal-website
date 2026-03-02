import TerminalSimulator, { Vector2 } from ".";
import { TextHelper, type RenderableChar, type RenderableText } from "./texthelper";
import fonts from "./fonts"

type SceneImage = {
    line: number,
    width: number,
    height: number, 
    offset: number,
    image: ImageBitmap
}

export default class CanvasRenderer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    charWidth: number;
    sim: TerminalSimulator;
    scene: {
        chars: RenderableChar[][];
        images: SceneImage[]
    }
    cursorBlink: {
        anim: number, // 0-20 blink anim
        blinkInterval: NodeJS.Timeout | undefined,
        blinkPauseTimeout: NodeJS.Timeout | undefined
    }; 

    constructor(canvas: HTMLCanvasElement, parent: TerminalSimulator){
        this.sim = parent;
        this.canvas = canvas;
        this.scene = {
            chars: [],
            images: []
        };
        this.ctx = canvas.getContext("2d")!;
        this.charWidth = 0; // The simulator will calculate this for us.
        this.cursorBlink = {
            anim: 0,
            blinkInterval: undefined,
            blinkPauseTimeout: undefined
        };

        this.setBlinkInterval();
    }
    private getCursorOffset(): number {
        let cursor = this.sim.state.cursor.position;
        let offset = (cursor.y + 1) - this.sim.size.y;
        
        return Math.max(0, offset);
    }
    renderText(text: RenderableText){
        let helper = new TextHelper(text);
        let res = helper.nextChar();
        let cursor = this.sim.state.cursor.position;

        while(res != false){
            // add this to the scene, so it can be rendered
            this.sceneAppend(res);

            this.sim.state.cursor.position.x++;
            if(res.char === "\n"){
                cursor.y += 1;
                cursor.x = 0;
            }
            
            res = helper.nextChar();
        }

        this.renderScene();
        setTimeout( () => {this.renderCursor()}, 0 ); // needs an extremely small delay so the cursor renders in the accurate position. jank, but works.
    }
    private setBlinkInterval(){
        this.cursorBlink.blinkInterval = setInterval( () => {
            this.cursorBlink.anim = (this.cursorBlink.anim + 1) % 20;
            this.renderCursor();
        }, 50)
    }
    pauseCursorBlinking(){
        clearInterval(this.cursorBlink.blinkInterval);

        if(this.cursorBlink.blinkPauseTimeout) clearTimeout(this.cursorBlink.blinkPauseTimeout);

        this.cursorBlink.anim = 0;

        this.cursorBlink.blinkPauseTimeout = setTimeout( () => {
            this.setBlinkInterval();
        }, 500);

        this.renderCursor();
    }
    renderCursor(){
        let cursor = this.sim.state.cursor;

        if(!cursor.visible) return;

        let cursorBounds: [number, number, number, number] = [
            0 + (this.charWidth * cursor.position.x),                                   // x
            4 + (this.sim.fontHeight * (cursor.position.y - this.getCursorOffset())),   // y
            1,                                                                          // w
            this.sim.fontHeight                                                         // h
        ];

        let opacity = this.cursorBlink.anim > 10 ? 10 - (this.cursorBlink.anim % 10) : this.cursorBlink.anim;
        let opacityMap = [1, 1, 1, 0.75, 0.5, 0.25, 0, 0, 0, 0];
        
        // opacity = (Math.sin((opacity / 10) * (Math.PI / 2)));
        opacity = opacityMap[opacity];
        
        this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        
        // you have to call it more than once to fully clear it.
        // i wish i was joking.
        this.ctx.clearRect(...cursorBounds);
        this.ctx.clearRect(...cursorBounds);
        
        this.ctx.fillRect(...cursorBounds);
    }
    private renderChar(char: RenderableChar, screenPos: Vector2){
        if(char.backgroundColor){
            this.ctx.fillStyle = typeof char.backgroundColor === "string" ? char.backgroundColor : this.sim.palette[char.backgroundColor];
            this.ctx.fillRect(
                this.charWidth * screenPos.x,
                this.sim.fontHeight * (screenPos.y)+4,
                this.charWidth+1,
                this.sim.fontHeight
            )
        }

        this.ctx.fillStyle = typeof char.color === "string" ? char.color : this.sim.palette[typeof char.color === "number" ? char.color : this.sim.state.textColor];
        this.ctx.font = `${this.sim.fontSize}px ${fonts[!char.style ? "normal" : char.style]}`
        this.ctx.fillText(char.char, this.charWidth * screenPos.x, this.sim.fontHeight * (screenPos.y+1));
    }
    private sceneAppend(char: RenderableChar){
        let cursor = this.sim.state.cursor.position;

        while(this.scene.chars.length < cursor.y + 1){
            this.scene.chars.push([]);
        }

        while(this.scene.chars[cursor.y].length < cursor.x + 1){
            this.scene.chars[cursor.y].push({char: ""});
        }

        this.scene.chars[cursor.y][cursor.x] = char;
    }
    addImageToScene(img: ImageBitmap, w = 5, h = 3, offset = 0){
        this.scene.images.push(
            {
                image: img,
                width: w,
                height: h,
                line: this.sim.state.cursor.position.y,
                offset: offset
            }
        );
        this.renderScene();
    }
    private renderImage(img: SceneImage){
        this.ctx.drawImage(
            img.image, 
            img.offset * this.charWidth,
            ( img.line - this.getCursorOffset() ) * this.sim.fontHeight + 4, 
            img.width * this.charWidth,
            img.height * this.sim.fontHeight
        );
    }
    renderScene(){
        let charsToRender = this.scene.chars.slice(this.getCursorOffset());
        let imagesToRender = this.scene.images.filter( (img) => img.line - this.getCursorOffset() + img.height >= 0);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        charsToRender.forEach( (line, y) => {
            line.forEach( (char, x) => {
                this.renderChar(char, {x, y})
            })
        })
        imagesToRender.forEach( (img) => {
            this.renderImage(img);
        })
    }
}