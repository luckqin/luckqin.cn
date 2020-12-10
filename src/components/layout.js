import React from 'react';
import { Link } from 'gatsby';
import Helmet from 'react-helmet';
import { rhythm } from '../utils/typography';

const Layout = ({ location, title, children }) => {
  const rootPath = `${__PATH_PREFIX__}/`;
  const isRootPath = location.pathname === rootPath;
  let header;

  if (isRootPath) {
    header = (
      <h1
        style={{
          marginBottom: 0,
          marginTop: 0,
        }}
      >
        <Link
          style={{
            boxShadow: 'none',
            textDecoration: 'none',
            color: 'var(--textTitle)',
          }}
          to={'/'}
        >
          {title}
        </Link>
      </h1>
    );
  } else {
    header = (
      <h3
        style={{
          fontFamily: 'Montserrat, sans-serif',
          marginTop: 0,
          marginBottom: 0,
          height: 42,
          lineHeight: '2.625rem',
        }}
      >
        <Link
          style={{
            boxShadow: 'none',
            textDecoration: 'none',
            color: 'rgb(255, 167, 196)',
          }}
          to={'/'}
        >
          {title}
        </Link>
      </h3>
    );
  }

  return (
    <div
      style={{
        color: 'var(--textNormal)',
        background: 'var(--bg)',
        transition: 'color 0.2s ease-out, background 0.2s ease-out',
        minHeight: '100vh',
      }}
      className="global-wrapper"
      data-is-root-path={isRootPath}
    >
      <Helmet
        meta={[
          {
            name: 'theme-color',
            content: '#282c35',
          },
        ]}
      />
      <div
        style={{
          marginLeft: 'auto',
          marginRight: 'auto',
          maxWidth: rhythm(32),
          padding: `2.625rem ${rhythm(3 / 4)}`,
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2.625rem',
          }}
        >
          {header}
        </header>
        <main>{children}</main>
        <footer>© {new Date().getFullYear()}</footer>
      </div>
    </div>
  );
};

export default Layout;
