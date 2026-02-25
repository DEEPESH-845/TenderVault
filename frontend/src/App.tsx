import { Authenticator } from '@aws-amplify/ui-react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import './services/auth'; // Initialize Amplify config

function App() {
  return (
    <Authenticator
      loginMechanisms={['email']}
      signUpAttributes={['email']}
      variation="default"
    >
      {({ signOut, user }) => (
        <BrowserRouter>
          <AppRoutes signOut={signOut!} user={user!} />
        </BrowserRouter>
      )}
    </Authenticator>
  );
}

export default App;
