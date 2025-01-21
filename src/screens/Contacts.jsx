export default function Contacts() {
  return (
    <>
      <header></header>
      <main>
        <div className="flex_item">
          <h2>Contacts</h2>
        </div>
        <div className="flex_container_contact">
          <div className="flex_item">
            <p className="contactInfo">Email: hirsimakiaaronn@gmail.com</p>
          </div>
          <div className="flex_item">
            <p className="contactInfo">Phone: 123456789</p>
          </div>
        </div>
        <div className="flex_container_contact">
          <div className="flex_item">
            <img src="src/images/gitti.png" alt="iconi" />
            <a href="https://github.com/AaronHirsimaki">Github</a>
          </div>
          <div className="flex_item">
            <img src="src/images/linkkari.png" alt="iconi" />
            <a href="https://www.linkedin.com/in/aaron-hirsim%C3%A4ki-848155268/">
              Linkedin
            </a>
          </div>
        </div>
        <div className="flex_item">
          <p className="contactInfo">CV</p>
        </div>
      </main>
      <footer></footer>
    </>
  );
}
