import Cards from "../components/cards";
import "./screens.css";

export default function Important() {
  const projectData = [
    {
      id: 1,
      image: "src/images/FreeGamesListLogo.jpg",
      title: "FreeGamesList",
      description:
        "Project done using React Native and a free API containing information about free games.",
      link: "https://github.com/AaronHirsimaki/freeGamesApp",
    },
    {
      id: 2,
      image: "src/images/LähiroskiksetLogo.png",
      title: "Lähiroskikset",
      description:
        "Project about a web application to locat trashcans. Done by using openstreetmap and javascript.",
      link: "https://github.com/orgs/Garbage-people/repositories",
    },
    {
      id: 3,
      image: "src/images/PikaPakka.png",
      title: "PikaPakka Korttipakka",
      description:
        "Tis is a project where I wanted to learnd about typescript and and development with typescript. I did use AI as help to understand typescript because I have not had a course about it",
      link: "https://github.com/AaronHirsimaki/Korttipakka",
    },
  ];

  return (
    <>
      <header></header>
      <main>
        <div className="skils-container">
        <div className="skils-box">
          <div>
            <h2 className="header-skils">Programming Skills</h2>
          </div>
          <div className="info-skils">
            <p>- Java programming</p>
            <p>Java programming using springboot</p>
            <p>- React programming</p>
            <p>React programming using libraries like MUI and tailwind</p>
            <p>- React native Mobile programming</p>
            <p>React native programming using basic libraries and self chosen API</p>
            <p>- Basics of Docker, Kubernetes and Openshift</p>
            <p>- Three software project courses with various themes and objectives</p>
            <p>Two software projects with groups from class for our own ideas and on for a real company</p>
          </div>
        </div>
        <div className="skils-box">
          <div>
            <h2 className="header-skils">Other Skils</h2>
          </div>
          <div className="info-skils">
            <p>- University tutor training and tutor activities</p>
            <p>- Board member of the Atkins substance organization</p>
          </div>
        </div>
        </div>
        <div>
          <h2 className="header">Major Projects of mine</h2>
        </div>
        <div className="projects-grid">
          {projectData.map((project) => (
            <Cards
              key={project.id}
              image={project.image}
              title={project.title}
              description={project.description}
              link={project.link}
            />
          ))}
        </div>
      </main>
      <footer></footer>
    </>
  );
}
