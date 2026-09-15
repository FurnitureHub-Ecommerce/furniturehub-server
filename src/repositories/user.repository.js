const User = require("../models/User.model");

//async là một hàm bất đồng bộ, nó cho phép bạn thực hiện các tác vụ không đồng bộ trong JavaScript. 
// Khi bạn sử dụng từ khóa async trước một hàm, nó sẽ trả về một Promise. Bên trong hàm async, bạn có thể sử dụng từ khóa await để chờ đợi kết quả của một Promise trước khi tiếp tục thực hiện các lệnh tiếp theo.
//ví dụ dễ hiểu về async và await trong JavaScript:
// Giả sử bạn có một hàm fetchData() trả về một Promise, và bạn muốn gọi hàm này và xử lý kết quả của nó. Bạn có thể sử dụng async và await như sau:


const findByEmail = async(email)=>{
    return await User.findOne({ email });
};
const findById = async(id)=>{
    return await User.findById(id);
};
const createUser = async(userData)=>{
    const user = new User(userData);
};
module.exports = {
    findByEmail,
    findById,
    createUser,
};