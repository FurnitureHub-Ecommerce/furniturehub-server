class LoginRequestDto {
  constructor({ email, password }) {
    this.email = email;
    this.password = password;
  }
}

module.exports = LoginRequestDto;