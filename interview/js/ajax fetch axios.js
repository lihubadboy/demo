// 原生的XHR
const xhr = new XMLHttpRequest();
xhr.open('GET', '/url', true);
xhr.send();


// 简单的的ajax请求
$.ajax({
    type: 'POST',
    url: url,
    data: data,
    dataType: dataType,
    success: function () { },
    error: function () { }
});

// 简单的axios请求
axios({
    type: 'post',
    url: url,
    data: {

    }
})
    .then((res) => {
        console.log(res);
    })
    .catch((err) => {
        console.log(err);
    })

// 简单fetch请求

try {
    const res = await fetch();
}
catch (e) { }



// 用promise 封装ajax

const fetch = (method = 'GET', url, data = null) => {
    return new Promsise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.onreadystatechange = () => {
            if (xhr.status === 2000 && xhr.readyState === 4) {
                resolve(xhr.responseText);
            } else {
                reject(xhr.responseText);
            }
        }
        xrh.send(data);
    })
}
fetch('GET', ".../", null).then(result => {
    console.log(result);
})


