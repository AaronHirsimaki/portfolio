import "./screens.css";

function Homepage() {
  return (
    <>
      <header className="header">
        <h1>About me</h1>
      </header>
      <main>
        <div className="flex_container">
          <div className="flex_item">
            <p className="info">
              Im a computer science trades student from Helsinki, and I complete
              my studies at Haaga-Helias Pasila campus. In my studies, I
              specialized in software development, and I have completed
              extensive courses on both front-end and back-end programming, as
              well as databases. In front-end development, I have used
              JavaScript, React and React Native, among others. In addition, I
              have familiarized myself with Reacts libraries, such as Material
              UI and Tailwind CSS. On the back-end side, I have focused on Java
              programming and especially the Spring Boot framework. I have
              developed my database skills using PostgreSQL and MongoDB
              databases. In addition, I have familiarized myself with the use of
              Docker to support software development.
            </p>
          </div>
        </div>
      </main>
      <footer></footer>
    </>
  );
}
export default Homepage;
