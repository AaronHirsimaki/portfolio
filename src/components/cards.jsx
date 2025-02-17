export default function Cards({ image, title, description, link }) {
  return (
    <div className="project-card">
      <img src={image} alt={title} className="project-image" />
      <div className="project-content">
        <h3>{title}</h3>
        <p style={{ color: "white" }}>{description}</p>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="project-link"
        >
          Read more here
        </a>
      </div>
    </div>
  );
}
