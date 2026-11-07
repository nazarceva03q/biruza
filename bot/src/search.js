'use strict';
const normalize=value=>String(value).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim();
function stem(word){return word.length<4?word:word.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|ий|ый|ой|ая|яя|ое|ее|ые|ие|ов|ев|ам|ям|ах|ях|ом|ем|ую|юю|а|я|ы|и|у|ю|е|о)$/,'')}
function near(a,b){if(a===b)return true;const x=stem(a),y=stem(b);if(x.length>=3&&y.length>=3&&(x===y||Math.min(x.length,y.length)>=4&&(x.startsWith(y)||y.startsWith(x))))return true;if(Math.min(x.length,y.length)<4||Math.abs(x.length-y.length)>1)return false;let previous=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){const row=[i];for(let j=1;j<=y.length;j++)row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(x[i-1]===y[j-1]?0:1));previous=row}return previous[y.length]<=1}
function score(name,query){const n=normalize(name),q=normalize(query);if(!q)return 0;if(n===q)return 100;if(n.includes(q))return 80;return q.split(' ').every(w=>n.split(' ').some(v=>near(w,v)))?60:0}
module.exports={normalize,score};
