import { useParams, useNavigate, useSearchParams,Navigate } from 'react-router-dom';

const RPage = () => {
    const { userEmail } = useParams<{ userEmail: string }>();

    return <Navigate to={`/admin/record/${userEmail}`} replace />;
};


export default RPage;