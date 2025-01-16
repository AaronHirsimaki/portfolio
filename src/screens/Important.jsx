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
      id: 1,
      image: "src/images/FreeGamesListLogo.jpg",
      title: "FreeGamesList",
      description:
        "Project done using React Native and a free API containing information about free games.",
      link: "https://github.com/AaronHirsimaki/freeGamesApp",
    },
  ];

  return (
    <>
      <header></header>
      <main>
        <div className="info">
          <p>- University tutor training and tutor activities</p>
          <p>- Board member of the Atkins substance organization</p>
          <p>- Basics of Docker, Kubernetes and Openshift</p>
          <p>- Java programming</p>
          <p>- React programming</p>
          <p>- React native Mobile programming</p>
          <p>- Three software project courses</p>
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
