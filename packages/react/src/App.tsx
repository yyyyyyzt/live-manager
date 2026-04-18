import { RouterProvider } from 'react-router-dom';
import { UIKitProvider } from '@tencentcloud/uikit-base-component-react';
import { router } from './router';
import './App.css';

function App() {
  return (
    <UIKitProvider theme='light'>
      <RouterProvider router={router} />
    </UIKitProvider>
  );
}

export default App;
