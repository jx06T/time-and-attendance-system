import { QRCodeSVG } from 'qrcode.react';

interface UserProfileQRCodeProps {
    value: string;
}

const UserProfileQRCode = ({ value }: UserProfileQRCodeProps) => {
    return (
        <div className="bg-neutral p-4 rounded-lg inline-block">
            <QRCodeSVG
                value={"https://attendance.cksc.tw/r/"+value}
                size={256}
                level={"H"}
            />
            <p className="text-center text-sm text-gray-700 mt-2 font-mono break-all">{value}</p>
        </div>
    );
};

export default UserProfileQRCode;