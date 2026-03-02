type SimpleTextBlock = string;

interface ComplexTextBlock {
    color?: number | string // index on palette, or custom hex code!
    backgroundColor?: number | string // same idea as text color
    style?: "normal" | "bold" | "italic" | "bolditalic"

    text: string
}

export type TextType = SimpleTextBlock | ComplexTextBlock;

export type RenderableText = TextType | TextType[];

export type RenderableChar = {
    color?: number | string // index on palette, or custom hex code!
    backgroundColor?: number | string // same idea as text color
    style?: "normal" | "bold" | "italic" | "bolditalic"

    char: string
}

export class TextHelper {
    state: {
        done: boolean
        currentBlockIndex: number
        currentBlock: TextType
        pos: number
    }
    text: RenderableText

    constructor(text: RenderableText){
        this.text = text
        this.state = {
            done: false,
            currentBlockIndex: 0,
            currentBlock: Array.isArray(text) ? text[0] : text,
            pos: 0
        }
    }

    private isComplex(text: TextType): text is ComplexTextBlock {
        return typeof text == "object";
    }

    nextChar(): RenderableChar | false { // false is a "done" signal.
        
        let current = this.state.currentBlock;
        
        let txt = this.isComplex(current) ? current.text : current;
        
        if(this.state.pos == txt.length || txt === ""){
            this.state.pos = 0;

            if(Array.isArray(this.text)){
                this.state.currentBlockIndex++;

                if(this.text.length === this.state.currentBlockIndex){
                    this.state.done = true
                } else {
                    this.state.currentBlock = this.text[this.state.currentBlockIndex];
                    
                }
            } else {
                this.state.done = true;
            }
        }

        current = this.state.currentBlock;
        txt = this.isComplex(current) ? current.text : current;

        if(this.state.done) return false;

        let toReturn: RenderableChar = {
            char: txt.substring(this.state.pos, this.state.pos+1)
        };
        
        if(this.isComplex(current)){
            let {text: _, ...rest} = current;
            toReturn = {...toReturn, ...rest};
        };

        this.state.pos++;

        return toReturn;
    }
}