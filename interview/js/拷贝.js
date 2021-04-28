//第一种

const deepclone = obj => {
    const tem = JSON.stringify(obj);
    return JSON.parse(tem);
}

//第二种
const deepclone = object => {
    const newObj = Array.isArray(object) ? [] : {};
    for (const key in object) {
        if (object.hasOwnProperty(key)) {
            const element = object[key];
            // 判断 element 是否是对象 如果是对象 就递归复制
            if(element && typeof element  === 'object'){
                newObj[key] = deepclone(element);
            }else{
                newObj[key] = element;
            }

        }
    }
    return newObj;
}