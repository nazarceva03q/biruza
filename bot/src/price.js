'use strict';
// Compatible with the reference bot: numeric prices, ranges or a confirmed custom label.
const prompt='Напишите, что показывать в строке цены: цену со знаком ₽, диапазон, «от … ₽» или любой другой текст. Например: 1000 ₽, 1000–2000 ₽, от 1000 ₽, Товар под заказ.';
function parse(text){const label=String(text).trim();if(!label||label.length>120)throw Error('PRODUCT');if(/^[-–]+$/.test(label))return{price:null,priceLabel:''};const match=label.match(/^((?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?)\s*(?:₽|руб(?:\.|лей|ля)?|р\.?)?$/i),n=match?Number(match[1].replace(/[ \u00a0\u202f]/g,'').replace(',','.')):null;if(n!==null&&(!Number.isFinite(n)||n<0||n>10000000))throw Error('PRODUCT');return{price:n,priceLabel:label}}
const format=(price,label)=>label||(Number.isFinite(price)?new Intl.NumberFormat('ru-RU').format(price)+' ₽':'Стоимость уточним');
module.exports={prompt,parse,format};
