class RegisterRequestDto {
  constructor({ fullName, email, password, phone }) {
    this.fullName = fullName;
    this.email = email;
    this.password = password;
    this.phone = phone;
  }
}

module.exports = RegisterRequestDto;