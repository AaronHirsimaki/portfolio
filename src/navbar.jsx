import React, { useState } from "react";
import { Link } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Drawer } from "@mui/material";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import useMediaQuery from "@mui/material/useMediaQuery";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width:600px)");

  const toggleDrawer = () => {
    setOpen(!open);
  };

  return (
    <div>
      <AppBar
        position="static"
        sx={{
          backgroundColor: "rgba(0, 0, 0, 0.7)", // Musta läpinäkyvä tausta
          backdropFilter: "blur(10px)", // Sumentaa taustan
          position: "static",
          width: "100%",
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleDrawer}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            component="inherit"
            sx={{ flexGrow: 1, fontFamily: '"Press Start 2P", serif' }}
          >
            Aaron Hirsimäki
          </Typography>
          {!isMobile && (
            <>
              <Button
                color="inherit"
                component={Link}
                to="/"
                sx={{
                  fontFamily: '"Press Start 2P", serif',
                  marginLeft: 10,
                  marginRight: 5,
                }}
              >
                About Me
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/Important"
                sx={{
                  fontFamily: '"Press Start 2P", serif',
                  marginRight: 5,
                }}
              >
                Projects and Skills
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/Goals"
                sx={{
                  fontFamily: '"Press Start 2P", serif',
                  marginRight: 5,
                }}
              >
                Goals
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/Contacts"
                sx={{
                  fontFamily: '"Press Start 2P", serif',
                  marginRight: 10,
                }}
              >
                Contact Info
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      {isMobile && (
        <Drawer anchor="left" open={open} onClose={toggleDrawer}>
          <Button
            color="inherit"
            component={Link}
            to="/"
            onClick={toggleDrawer}
          >
            About Me
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/Important"
            onClick={toggleDrawer}
          >
            Projects and Skills
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/Goals"
            onClick={toggleDrawer}
          >
            Goals
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/Contacts"
            onClick={toggleDrawer}
          >
            Contact Info
          </Button>
        </Drawer>
      )}
    </div>
  );
}
