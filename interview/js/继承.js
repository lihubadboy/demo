// 1 借用构造函数继承  call apply bind

function Person(name,sex){
  this.name = name;
  this.sex = sex;
}

function Boy(name,sex){
   Person.call(this,name,sex);
   Person.apply(this,[name,sex]);
   Person.bind(this)(name,sex);
   this.hobby = 'baskeball';
}