//函数的表达方式

// 函数声明
function hello(name){
   console.log(name);
}

// 函数表达式
const hello = function(name){
    console.log(name);
}

// 构造函数
function Person(name){
   this.name = name;
   this.sayname = function(){
       console.log(this.name);
   }
}

