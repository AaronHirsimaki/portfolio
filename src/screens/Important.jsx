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
      image: "src/images/LähiroskiksetLogo.png",
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
        <div>
          <h2 className="header">Skils and courses</h2>
        </div>
        <div className="info-skils">
          <p>- University tutor training and tutor activities</p>
          <p>- Board member of the Atkins substance organization</p>
          <p>- Basics of Docker, Kubernetes and Openshift</p>
          <p>- Java programming</p>
          <p>- React programming</p>
          <p>- React native Mobile programming</p>
          <p>- Three software project courses</p>
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
