import sharp from "sharp";
import { mkdir } from "node:fs/promises";
await mkdir("/tmp/portfolio-motion",{recursive:true});
for(let frame=0;frame<24;frame++){
 const circles=Array.from({length:28},(_,i)=>{
  const t=(frame/24+i/28)%1;
  const startY=28+i*11;
  const x=40+t*560;
  const y=startY+(180-startY)*Math.sin(t*Math.PI/2);
  return `<circle cx="${x}" cy="${y}" r="${2+t*2}" fill="${i%3===0?'#efbd83':'#79bdd3'}" opacity="${.25+Math.sin(t*Math.PI)*.7}"/>`;
 }).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#0b1420"/><g fill="none" stroke="#26384a">${Array.from({length:9},(_,i)=>`<path d="M35 ${35+i*36} Q300 ${35+i*36} 570 180"/>`).join('')}<circle cx="570" cy="180" r="40"/><circle cx="570" cy="180" r="55" stroke-dasharray="2 7"/></g>${circles}<circle cx="570" cy="180" r="12" fill="#efbd83"/><text x="30" y="330" font-family="monospace" font-size="11" fill="#8cabbf">INPUTS</text><text x="465" y="330" font-family="monospace" font-size="11" fill="#efbd83">DECISION ENGINE</text></svg>`;
 await sharp(Buffer.from(svg)).png().toFile(`/tmp/portfolio-motion/frame-${String(frame).padStart(2,'0')}.png`);
 if(frame===0)await sharp(Buffer.from(svg)).png().toFile('public/assets/system-still.png');
}
